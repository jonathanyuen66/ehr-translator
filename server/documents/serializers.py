import hashlib

from rest_framework import serializers

from .models import Annotation, Document

MAX_UPLOAD_SIZE = 25 * 1024 * 1024

# Extension is the real gate here, not the browser-supplied content_type —
# HEIC in particular gets reported inconsistently across browsers/OSes
# (often "application/octet-stream" rather than "image/heic"), so a
# content_type check would reject a lot of genuine iPhone photos. A file
# that lies about its extension just fails at extraction time instead (same
# as an already-corrupt PDF does today) rather than being caught here.
_ALLOWED_EXTENSIONS = (".pdf", ".jpg", ".jpeg", ".png", ".heic", ".heif")


class AnnotationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Annotation
        fields = ["language", "summary", "items", "created_at"]


class DocumentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = ["id", "file", "original_filename", "display_name", "status", "created_at", "file_url"]
        extra_kwargs = {"file": {"write_only": True, "required": True}}
        read_only_fields = ["id", "original_filename", "status", "created_at", "file_url"]

    def validate_file(self, value):
        if not value.name.lower().endswith(_ALLOWED_EXTENSIONS):
            raise serializers.ValidationError("Only PDF, JPG, PNG, or HEIC files are allowed.")
        if value.size > MAX_UPLOAD_SIZE:
            raise serializers.ValidationError("File must be smaller than 25MB.")

        hasher = hashlib.sha256()
        for chunk in value.chunks():
            hasher.update(chunk)
        value.seek(0)
        content_hash = hasher.hexdigest()

        request = self.context.get("request")
        existing = Document.objects.filter(owner=request.user, content_hash=content_hash).first()
        if existing:
            raise serializers.ValidationError(
                f'You\'ve already uploaded this file (as "{existing.display_name}").'
            )

        # Stashed for the view's perform_create — avoids re-reading/hashing
        # the file a second time.
        self.content_hash = content_hash
        return value

    def validate_display_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Name can't be empty.")
        return value

    def get_file_url(self, obj):
        return f"/api/documents/{obj.id}/file/"
