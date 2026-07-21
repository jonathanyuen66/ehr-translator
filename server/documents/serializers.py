from rest_framework import serializers

from .models import Annotation, Document

MAX_UPLOAD_SIZE = 25 * 1024 * 1024


class AnnotationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Annotation
        fields = ["language", "summary", "items", "created_at"]


class DocumentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = ["id", "file", "original_filename", "status", "created_at", "file_url"]
        extra_kwargs = {"file": {"write_only": True, "required": True}}
        read_only_fields = ["id", "original_filename", "status", "created_at", "file_url"]

    def validate_file(self, value):
        if value.content_type != "application/pdf" or not value.name.lower().endswith(".pdf"):
            raise serializers.ValidationError("Only PDF files are allowed.")
        if value.size > MAX_UPLOAD_SIZE:
            raise serializers.ValidationError("File must be smaller than 25MB.")
        return value

    def get_file_url(self, obj):
        return f"/api/documents/{obj.id}/file/"
