import logging

from django.conf import settings
from google.cloud import vision

logger = logging.getLogger(__name__)

_client = None
_warned_not_configured = False


def _get_client():
    global _client
    if _client is None:
        _client = vision.ImageAnnotatorClient()
    return _client


def extract_text(image_bytes: bytes) -> str:
    """OCR pass for an image upload (JPG/PNG/HEIC) — the image-upload
    equivalent of pdfplumber's role for a PDF in services.py: turns the
    upload into plain text, before anything else in the pipeline runs.
    Its output flows through the exact same deidentify()/Gemini path as
    PDF-extracted text, so this must never hand back anything the model
    itself has interpreted — just the literal text on the page, the same
    contract pdfplumber already has.

    Raises if VISION_PROJECT_ID isn't configured, rather than the
    skip-with-a-warning pattern documents/dlp.py uses — DLP is one
    defense-in-depth layer among several, but OCR is the only way to get any
    text out of an image at all, so there's no reasonable text to fall back
    to. The caller (services.extract_text) already treats any exception here
    as extraction failure, same as a corrupt/unreadable PDF.
    """
    if not settings.VISION_PROJECT_ID:
        global _warned_not_configured
        if not _warned_not_configured:
            logger.warning(
                "VISION_PROJECT_ID is not set — image uploads can't be OCR'd "
                "locally. This is fine for local dev (PDF uploads are "
                "unaffected) but must be configured before processing any "
                "real image upload."
            )
            _warned_not_configured = True
        raise RuntimeError("Image OCR is not configured in this environment.")

    image = vision.Image(content=image_bytes)
    # document_text_detection (not the plain text_detection) is tuned for
    # dense blocks of text on a page rather than sparse text in a photo —
    # the right mode for a photographed or scanned report.
    response = _get_client().document_text_detection(image=image)
    if response.error.message:
        raise RuntimeError(f"Cloud Vision OCR failed: {response.error.message}")
    return response.full_text_annotation.text.strip()
