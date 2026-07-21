from django.conf import settings
from django.db import models


class Document(models.Model):
    class Status(models.TextChoices):
        PROCESSING = "processing", "Processing"
        READY = "ready", "Ready"
        FAILED = "failed", "Failed"

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="documents")
    file = models.FileField(upload_to="documents/%Y/%m/")
    original_filename = models.CharField(max_length=255)
    # User-editable label shown in the UI — defaults to original_filename at
    # upload time but can be changed any time; original_filename itself never
    # changes, since it's the provenance record of what was actually uploaded.
    display_name = models.CharField(max_length=255, blank=True)
    # SHA-256 of the file bytes, used to reject a duplicate upload from the
    # same owner. Deliberately scoped per-owner (not a global unique
    # constraint) — a global one would let one user's upload attempt reveal
    # that another user already has the identical file, which is exactly the
    # kind of cross-account leak this app's isolation model exists to prevent.
    content_hash = models.CharField(max_length=64, blank=True, db_index=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PROCESSING)
    extracted_text = models.TextField(blank=True)
    # Language-independent output of the "identify findings + gather real
    # PubMed candidates" pass, cached so switching the annotation language
    # later only needs one more Gemini call, not a full re-run.
    findings = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["owner", "content_hash"],
                condition=~models.Q(content_hash=""),
                name="unique_owner_content_hash",
            )
        ]

    def __str__(self):
        return f"{self.original_filename} ({self.owner.email})"


class Annotation(models.Model):
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="annotations")
    language = models.CharField(max_length=10, default="en")
    summary = models.TextField(blank=True)
    items = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ["document", "language"]

    def __str__(self):
        return f"{self.document_id} ({self.language})"
