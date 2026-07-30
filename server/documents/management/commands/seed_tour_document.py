import io

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand

from accounts.models import User
from documents.gemini import LANGUAGE_NAMES
from documents.models import Annotation, Document
from documents.services import build_annotations_for_language, build_findings_with_candidates, extract_text

TOUR_USER_EMAIL = "tour@plainmed.local"

# Deliberately reuses the same clinical sentence already shown, untranslated,
# on the home page's live demo (DemoPreview.jsx) and in the redaction
# example (HowItWorks.jsx) — a returning visitor sees one consistent
# synthetic report throughout the product, not three different ones. The
# fabricated header block gives the redaction step (and the document
# viewer's "why can I still see this" note) something real to point at.
SAMPLE_REPORT_TEXT = """Patient Name: Jordan Rivera
Date of Birth: 03/14/1968
MRN: 5551234
Address: 87 Maple Street, Rivertown

CLINICAL HISTORY: Patient presents with a persistent cough and unexplained fatigue.

FINDINGS: There is a hypermetabolic right paratracheal lymph node measuring 1.4 x 1.1 cm, with an SUVmax of 4.6.

No abnormal uptake within the liver, spleen, or adrenal glands. Mild diffuse uptake in the thyroid gland, likely physiologic."""


def _build_sample_pdf() -> bytes:
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas

    buffer = io.BytesIO()
    doc = canvas.Canvas(buffer, pagesize=letter)
    doc.setFont("Helvetica", 11)
    y = 740
    for line in SAMPLE_REPORT_TEXT.split("\n"):
        doc.drawString(72, y, line)
        y -= 18
    doc.save()
    return buffer.getvalue()


class Command(BaseCommand):
    help = "Seeds (or re-seeds) the one shared, synthetic document behind the guided product tour."

    def handle(self, *args, **options):
        # Never on the Invite list and never usable for real sign-in — this
        # account exists purely to satisfy Document.owner's required FK.
        tour_user, _ = User.objects.get_or_create(email=TOUR_USER_EMAIL)
        tour_user.is_active = False
        tour_user.set_unusable_password()
        tour_user.save()

        # Idempotent re-seed: drop any previous tour sample (and its
        # annotations, via CASCADE) rather than leaving stale duplicates
        # around every time this command runs.
        Document.objects.filter(is_tour_sample=True).delete()

        document = Document(
            owner=tour_user,
            original_filename="sample-report.pdf",
            display_name="Sample report (guided tour)",
            is_tour_sample=True,
        )
        document.file.save("sample-report.pdf", ContentFile(_build_sample_pdf()), save=False)
        document.extracted_text = extract_text(document.file)
        document.status = Document.Status.READY
        document.findings = build_findings_with_candidates(document.extracted_text)
        document.save()

        for language in LANGUAGE_NAMES:
            self.stdout.write(f"Generating {language} annotations...")
            result = build_annotations_for_language(document.extracted_text, document.findings, language)
            Annotation.objects.update_or_create(
                document=document,
                language=language,
                defaults={"summary": result["summary"], "items": result["items"]},
            )

        self.stdout.write(self.style.SUCCESS(f"Seeded tour document id={document.id}"))
