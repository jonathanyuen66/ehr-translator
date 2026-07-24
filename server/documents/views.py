import logging

from django.http import FileResponse
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from . import gemini
from .models import Annotation, Document, DocumentAccessLog
from .serializers import AnnotationSerializer, DocumentSerializer
from .services import (
    PersonalInfoSelected,
    build_annotations_for_language,
    build_findings_with_candidates,
    explain_ad_hoc_term,
    extract_text,
)

# A generous but bounded limit — this becomes a Gemini + PubMed call per
# request, so it's a cost/abuse guard, not a UX constraint (nobody is
# selecting a 300-character phrase and expecting a single clean "term").
MAX_EXPLAIN_TERM_LENGTH = 300

logger = logging.getLogger(__name__)


class DocumentViewSet(viewsets.ModelViewSet):
    serializer_class = DocumentSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "patch", "delete"]

    def get_queryset(self):
        # Scoping every query to the requesting user is what actually
        # enforces per-user isolation — the client never gets a say.
        return Document.objects.filter(owner=self.request.user).order_by("-created_at")

    def perform_create(self, serializer):
        file_obj = self.request.FILES.get("file")
        original_filename = file_obj.name if file_obj else ""
        display_name = (self.request.data.get("display_name") or "").strip() or original_filename
        document = serializer.save(
            owner=self.request.user,
            original_filename=original_filename,
            display_name=display_name,
            content_hash=serializer.content_hash,
        )
        DocumentAccessLog.record(self.request.user, document, DocumentAccessLog.Action.UPLOAD)
        # Synchronous for now (no Celery/task queue) — fine at family scale;
        # revisit only if extraction becomes noticeably slow.
        try:
            document.extracted_text = extract_text(document.file)
            document.status = Document.Status.READY
        except Exception:
            logger.exception("PDF text extraction failed for document %s", document.id)
            document.status = Document.Status.FAILED
        document.save(update_fields=["extracted_text", "status"])

        if document.status == Document.Status.READY:
            # Best-effort: if annotation generation fails, the document stays
            # viewable, it just has no annotations yet — extraction succeeding
            # is what actually gates whether the PDF itself can be viewed.
            try:
                document.findings = build_findings_with_candidates(document.extracted_text)
                document.save(update_fields=["findings"])
                result = build_annotations_for_language(document.extracted_text, document.findings, "en")
                Annotation.objects.update_or_create(
                    document=document,
                    language="en",
                    defaults={"summary": result["summary"], "items": result["items"]},
                )
            except Exception:
                logger.exception("Annotation generation failed for document %s", document.id)

    def perform_destroy(self, instance):
        # Logged before, not after: SET_NULL on DocumentAccessLog.document
        # needs the row it's about to be nulled-out on to exist and be
        # deleted afterward, and instance.display_name has to still be
        # readable to snapshot it.
        DocumentAccessLog.record(self.request.user, instance, DocumentAccessLog.Action.DELETE)
        instance.file.delete(save=False)
        instance.delete()

    @action(detail=True, methods=["get"])
    def file(self, request, pk=None):
        # get_object() runs against get_queryset(), so a non-owner requesting
        # someone else's document id gets a 404, not the file.
        document = self.get_object()
        DocumentAccessLog.record(request.user, document, DocumentAccessLog.Action.DOWNLOAD)
        return FileResponse(
            document.file.open("rb"),
            content_type="application/pdf",
            filename=document.original_filename,
        )

    @action(detail=True, methods=["get"])
    def annotations(self, request, pk=None):
        document = self.get_object()
        DocumentAccessLog.record(request.user, document, DocumentAccessLog.Action.VIEW)
        language = request.query_params.get("language", "en")

        if language not in gemini.LANGUAGE_NAMES:
            return Response({"detail": f"Unsupported language '{language}'."}, status=400)

        annotation = Annotation.objects.filter(document=document, language=language).first()
        if annotation is not None:
            return Response(AnnotationSerializer(annotation).data)

        if document.status != Document.Status.READY or not document.findings:
            return Response(
                {"detail": "Annotations not available for this document yet."},
                status=404,
            )

        # Not cached yet for this language — generate it now. The expensive
        # part (finding the terms + real PubMed candidates) already ran once
        # at upload time and is reused here, so this is a single Gemini call.
        try:
            result = build_annotations_for_language(document.extracted_text, document.findings, language)
        except Exception:
            logger.exception(
                "Annotation generation failed for document %s language %s", document.id, language
            )
            return Response(
                {"detail": "Could not generate annotations in this language right now."},
                status=502,
            )

        annotation, _ = Annotation.objects.update_or_create(
            document=document,
            language=language,
            defaults={"summary": result["summary"], "items": result["items"]},
        )
        return Response(AnnotationSerializer(annotation).data)

    @action(detail=True, methods=["post"])
    def explain(self, request, pk=None):
        """On-demand explanation for a phrase the reader selected themselves
        in the document viewer — the complement to `annotations` above,
        which only ever returns identify_findings's own automatic picks.
        """
        document = self.get_object()
        term = (request.data.get("term") or "").strip()
        language = request.data.get("language", "en")

        if not term:
            return Response({"detail": "Select some text first."}, status=400)
        if len(term) > MAX_EXPLAIN_TERM_LENGTH:
            return Response({"detail": "Select a shorter phrase."}, status=400)
        if language not in gemini.LANGUAGE_NAMES:
            return Response({"detail": f"Unsupported language '{language}'."}, status=400)
        if document.status != Document.Status.READY:
            return Response({"detail": "Document isn't ready yet."}, status=409)

        try:
            item = explain_ad_hoc_term(document, term, language)
        except PersonalInfoSelected:
            # Deliberately no document/term in this log line, unlike the
            # except below — logging the very thing we just refused to send
            # onward would defeat the point.
            logger.info("Refused to explain a selection that looked like personal information")
            return Response(
                {
                    "detail": "That looks like it might be personal information (like a name or "
                    "date), not a clinical term — for your privacy, we don't send that to be "
                    "explained. Try selecting a medical term or measurement instead."
                },
                status=400,
            )
        except Exception:
            logger.exception("Ad-hoc explanation failed for document %s term %r", document.id, term)
            return Response({"detail": "Could not explain that right now."}, status=502)

        DocumentAccessLog.record(request.user, document, DocumentAccessLog.Action.VIEW)
        return Response(item)
