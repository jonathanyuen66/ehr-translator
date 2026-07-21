import logging

from django.http import FileResponse
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from . import gemini
from .models import Annotation, Document
from .serializers import AnnotationSerializer, DocumentSerializer
from .services import build_annotations_for_language, build_findings_with_candidates, extract_text

logger = logging.getLogger(__name__)


class DocumentViewSet(viewsets.ModelViewSet):
    serializer_class = DocumentSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "delete"]

    def get_queryset(self):
        # Scoping every query to the requesting user is what actually
        # enforces per-user isolation — the client never gets a say.
        return Document.objects.filter(owner=self.request.user).order_by("-created_at")

    def perform_create(self, serializer):
        file_obj = self.request.FILES.get("file")
        document = serializer.save(
            owner=self.request.user,
            original_filename=file_obj.name if file_obj else "",
        )
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
        instance.file.delete(save=False)
        instance.delete()

    @action(detail=True, methods=["get"])
    def file(self, request, pk=None):
        # get_object() runs against get_queryset(), so a non-owner requesting
        # someone else's document id gets a 404, not the file.
        document = self.get_object()
        return FileResponse(
            document.file.open("rb"),
            content_type="application/pdf",
            filename=document.original_filename,
        )

    @action(detail=True, methods=["get"])
    def annotations(self, request, pk=None):
        document = self.get_object()
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
