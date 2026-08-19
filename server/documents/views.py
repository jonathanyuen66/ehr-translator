import logging
import mimetypes

from django.http import FileResponse
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response

from . import gemini
from .models import Document, DocumentAccessLog
from .serializers import AnnotationSerializer, DocumentSerializer
from .services import (
    PersonalInfoSelected,
    build_findings_with_candidates,
    explain_ad_hoc_term,
    extract_text,
    get_or_create_annotation,
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
        # enforces per-user isolation — the client never gets a say. The
        # `list` action stays exactly this strict (the shared tour sample
        # must never show up in anyone's real "Your reports"); every other
        # action additionally allows the one flagged tour-sample document
        # regardless of owner, so any authenticated user can view/explain
        # the same shared, synthetic document through these same endpoints.
        owned = Document.objects.filter(owner=self.request.user)
        if self.action == "list":
            return owned.order_by("-created_at")
        return (owned | Document.objects.filter(is_tour_sample=True)).order_by("-created_at")

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
            logger.exception("Text extraction failed for document %s", document.id)
            document.status = Document.Status.FAILED
        document.save(update_fields=["extracted_text", "status"])

        if document.status == Document.Status.READY:
            # Best-effort: if annotation generation fails, the document stays
            # viewable, it just has no annotations yet — extraction succeeding
            # is what actually gates whether the PDF itself can be viewed.
            try:
                document.findings = build_findings_with_candidates(document.extracted_text)
                document.save(update_fields=["findings"])
            except Exception:
                logger.exception("Finding identification failed for document %s", document.id)
            else:
                # Every supported language, not just English — translation is
                # cheap and fast enough to do eagerly here rather than making
                # a reader wait on it the first time they switch languages
                # (get_or_create_annotation's whole reason for existing).
                # Each language is its own try/except so one language failing
                # (e.g. Translation misconfigured) doesn't cost the others.
                for language in gemini.LANGUAGE_NAMES:
                    try:
                        get_or_create_annotation(document, language)
                    except Exception:
                        logger.exception(
                            "Annotation generation failed for document %s language %s",
                            document.id,
                            language,
                        )

    def perform_update(self, serializer):
        # The shared tour sample is reachable through these same endpoints
        # by any authenticated user (see get_queryset above) so its findings
        # stay realistic — but only rename/delete need blocking here, since
        # those are the only actions that would mutate or remove it for
        # everyone else too.
        if serializer.instance.is_tour_sample:
            raise PermissionDenied("The sample document can't be edited.")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.is_tour_sample:
            raise PermissionDenied("The sample document can't be deleted.")
        # Logged before, not after: SET_NULL on DocumentAccessLog.document
        # needs the row it's about to be nulled-out on to exist and be
        # deleted afterward, and instance.display_name has to still be
        # readable to snapshot it.
        DocumentAccessLog.record(self.request.user, instance, DocumentAccessLog.Action.DELETE)
        instance.file.delete(save=False)
        instance.delete()

    @action(detail=False, methods=["get"])
    def tour(self, request):
        """Lets the frontend discover the shared tour-sample document's id
        without hardcoding a PK that varies per environment/seed run — the
        guided tour then drives the exact same detail endpoints below
        (file/annotations/explain) any real document uses.
        """
        document = Document.objects.filter(is_tour_sample=True).first()
        if document is None:
            raise NotFound("The tour sample hasn't been seeded yet.")
        return Response(DocumentSerializer(document, context={"request": request}).data)

    @action(detail=True, methods=["get"])
    def file(self, request, pk=None):
        # get_object() runs against get_queryset(), so a non-owner requesting
        # someone else's document id gets a 404, not the file.
        document = self.get_object()
        DocumentAccessLog.record(request.user, document, DocumentAccessLog.Action.DOWNLOAD)
        # Derived from the original filename rather than hardcoded, now that
        # uploads aren't always PDFs — the frontend uses this to decide
        # whether to render a PDF viewer or a plain image.
        content_type, _ = mimetypes.guess_type(document.original_filename)
        return FileResponse(
            document.file.open("rb"),
            content_type=content_type or "application/octet-stream",
            filename=document.original_filename,
        )

    @action(detail=True, methods=["get"])
    def annotations(self, request, pk=None):
        document = self.get_object()
        DocumentAccessLog.record(request.user, document, DocumentAccessLog.Action.VIEW)
        language = request.query_params.get("language", "en")

        if language not in gemini.LANGUAGE_NAMES:
            return Response({"detail": f"Unsupported language '{language}'."}, status=400)

        # Almost always already cached — perform_create generates every
        # supported language eagerly at upload time. This lazy path only
        # actually does work for a document uploaded before that existed, or
        # if generating one of the other languages failed at upload time.
        if document.status != Document.Status.READY or not document.findings:
            return Response(
                {"detail": "Annotations not available for this document yet."},
                status=404,
            )

        try:
            annotation = get_or_create_annotation(document, language)
        except Exception:
            logger.exception(
                "Annotation generation failed for document %s language %s", document.id, language
            )
            return Response(
                {"detail": "Could not generate annotations in this language right now."},
                status=502,
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
