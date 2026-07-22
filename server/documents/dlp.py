import logging
import re

from django.conf import settings
from google.cloud import dlp_v2

logger = logging.getLogger(__name__)

# Built-in Cloud DLP infoTypes covering the HIPAA identifiers most likely to
# show up in free-flowing clinical narrative (as opposed to the labeled
# header fields deidentify.py's own regex pass already handles). Medical
# record numbers aren't included — DLP has no reliable built-in infoType for
# them since the format varies per institution, and that's already covered by
# the labeled-field regex pass.
_INFO_TYPES = [
    "PERSON_NAME",
    "DATE_OF_BIRTH",
    "AGE",
    "DATE",
    "PHONE_NUMBER",
    "EMAIL_ADDRESS",
    "STREET_ADDRESS",
    "LOCATION",
    "US_SOCIAL_SECURITY_NUMBER",
    "US_HEALTHCARE_NPI",
    "US_DRIVERS_LICENSE_NUMBER",
    "US_PASSPORT",
]

_client = None
_warned_not_configured = False


def _get_client():
    global _client
    if _client is None:
        _client = dlp_v2.DlpServiceClient()
    return _client


def redact(text: str) -> str:
    """First pass of the redaction pipeline: run the raw extracted text
    through Cloud DLP's pre-built HIPAA-identifier detectors before it ever
    reaches the second-pass regex/NER logic in deidentify.py. This is a
    defense-in-depth layer, not a replacement for that second pass — DLP's
    generic detectors and the app's clinical-context-aware regex/NER catch
    different things.

    Skips (with a one-time warning) if DLP_PROJECT_ID isn't configured, so
    local dev works without GCP credentials. In any deployed environment this
    must be configured — see README. If DLP_PROJECT_ID *is* configured but
    the API call itself fails, the exception is left to propagate: callers
    must not treat that as "nothing to redact", since silently falling
    through to just the second pass on an API failure would be a silent
    coverage gap, not a graceful degradation.
    """
    if not text:
        return text

    if not settings.DLP_PROJECT_ID:
        global _warned_not_configured
        if not _warned_not_configured:
            logger.warning(
                "DLP_PROJECT_ID is not set — skipping the Cloud DLP redaction "
                "pass. This is fine for local dev but must be configured "
                "before processing any real patient data."
            )
            _warned_not_configured = True
        return text

    parent = f"projects/{settings.DLP_PROJECT_ID}/locations/global"
    inspect_config = {"info_types": [{"name": name} for name in _INFO_TYPES]}
    deidentify_config = {
        "info_type_transformations": {
            "transformations": [
                {
                    "primitive_transformation": {
                        "replace_config": {
                            "new_value": {"string_value": "[REDACTED]"}
                        }
                    }
                }
            ]
        }
    }
    response = _get_client().deidentify_content(
        request={
            "parent": parent,
            "inspect_config": inspect_config,
            "deidentify_config": deidentify_config,
            "item": {"value": text},
        }
    )
    return _collapse_adjacent_tokens(response.item.value)


# DLP replaces each finding independently, so overlapping findings (e.g.
# PERSON_NAME matching "maria" and "garcia" as two separate findings, both
# nested inside a single EMAIL_ADDRESS match on "maria.garcia@example.com")
# produce runs of back-to-back "[REDACTED]" tokens for what should read as
# one redacted span. Harmless for privacy — nothing leaks — but it wastes
# real tokens on every downstream Gemini call for zero information, so it's
# collapsed here rather than left in.
_ADJACENT_TOKENS_REGEX = re.compile(r"\[REDACTED\](?:\s*\[REDACTED\])+")


def _collapse_adjacent_tokens(text: str) -> str:
    return _ADJACENT_TOKENS_REGEX.sub("[REDACTED]", text)
