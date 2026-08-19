import logging

from django.conf import settings
from google.cloud import translate

logger = logging.getLogger(__name__)

_client = None
_warned_not_configured = False


def _get_client():
    global _client
    if _client is None:
        _client = translate.TranslationServiceClient()
    return _client


def translate_texts(texts: list[str], language: str) -> list[str]:
    """Batch-translates English strings into `language` in one API call —
    documents/services.py's get_or_create_annotation uses this to derive
    every non-English Annotation from the canonical English one, rather than
    a second independent Gemini generation per language. Cheaper, near-
    instant, and (the actual point) guaranteed to describe the same content
    every language sees, instead of a second LLM pass that could subtly
    diverge in what it chooses to emphasize.

    Order is preserved 1:1 with the input list — callers rely on this to
    zip the results back onto whatever they came from (a summary, a list of
    per-finding explanations) without needing to match strings back up.

    Raises if TRANSLATE_PROJECT_ID isn't configured, rather than the
    skip-with-a-warning pattern documents/dlp.py uses — like OCR in
    documents/vision.py, there's no reasonable text to fall back to. Callers
    already treat a non-English Annotation as best-effort (see
    services.get_or_create_annotation), so this just means that language
    isn't available rather than a hard failure.
    """
    if not texts:
        return []

    if not settings.TRANSLATE_PROJECT_ID:
        global _warned_not_configured
        if not _warned_not_configured:
            logger.warning(
                "TRANSLATE_PROJECT_ID is not set — non-English annotations can't be "
                "produced locally. This is fine for local dev (English is unaffected) "
                "but must be configured before this needs to serve a real non-English "
                "request."
            )
            _warned_not_configured = True
        raise RuntimeError("Translation is not configured in this environment.")

    # This app's own language codes ("es", "zh-Hant") already match Cloud
    # Translation's target-language codes directly — verified against the
    # live API rather than assumed, since "zh-Hant" isn't universally a
    # given (Cloud Translation also accepts the "zh-TW" alias for the same
    # thing; either works, "zh-Hant" was picked to match LANGUAGE_NAMES
    # exactly and avoid a separate mapping table).
    response = _get_client().translate_text(
        request={
            "parent": f"projects/{settings.TRANSLATE_PROJECT_ID}/locations/global",
            "contents": texts,
            "mime_type": "text/plain",
            "source_language_code": "en",
            "target_language_code": language,
        }
    )
    return [t.translated_text for t in response.translations]
