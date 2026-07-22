import logging
import re

import spacy

from . import dlp

logger = logging.getLogger(__name__)

# Best-effort redaction, run in four passes before any text leaves the system
# on its way to Gemini. No single pass is sufficient on its own — that's why
# there are four:
#
# 0. Cloud DLP (see dlp.py), over the raw text. Pre-built, Google-maintained
#    detectors for generic HIPAA identifiers (names, SSNs, phone numbers,
#    addresses, dates) — the first line of defense, and the only one of the
#    four that isn't specific to this app's code or this app's blind spots.
# 1. A labeled-field regex, for the structured header block most scan
#    reports use ("Patient Name: Jane Doe" -> "Patient Name: [REDACTED]").
#    Catches things a generic language model has no special notion of, like
#    "MRN:" or "Account Number:", but only when the identifier follows one of
#    these exact labels on its own line.
# 2. A targeted regex for "Patient <Name>" / "Pt. <Name>" narrative mentions.
#    This exists because of a specific, confirmed blind spot: spaCy's small
#    English model fails to recognize a name at all when it directly follows
#    a capitalized "Patient" at the start of a sentence (e.g. "Patient Jane
#    Doe presents with...") — rephrasing as "Jane Doe presents..." is
#    recognized fine, but this exact phrasing, which is extremely common in
#    clinical narrative text, is not. Cheap, targeted patch for a
#    demonstrated gap rather than a hypothetical one.
# 3. A spaCy NER (named entity recognition) pass over the whole remaining
#    text, which catches other identifiers mentioned in free-flowing prose
#    that neither regex reaches, by recognizing a span as a person's name (or
#    location, or date) from context, not from a preceding label.
#
# This is still a mitigation, not a guarantee: NER models make mistakes (miss
# unusual names, occasionally mis-tag ordinary words), and de-identification
# in general is a hard, actively-researched problem. It exists specifically
# because the Gemini free tier's terms permit Google to use inputs to improve
# their products — reducing exposure, not eliminating it.

_LABELED_FIELD_PATTERNS = [
    r"(patient\s*name|name)",
    r"(date\s*of\s*birth|dob)",
    r"(medical\s*record\s*(number|no\.?)|mrn)",
    r"(account\s*(number|no\.?))",
    r"(address)",
    r"(phone|telephone)",
    r"(ssn|social\s*security\s*(number|no\.?))",
]

_FIELD_REGEX = re.compile(
    r"(?im)^(?P<label>\s*(?:" + "|".join(_LABELED_FIELD_PATTERNS) + r")\s*:)\s*(?P<value>.+)$"
)

_NARRATIVE_PATIENT_NAME_REGEX = re.compile(
    r"\b(?:Patient|Pt\.?)\s+(?P<name>[A-Z][a-zA-Z'-]*\.?(?:\s+[A-Z][a-zA-Z'-]*\.?){0,3})"
)

# Entity types redacted by the NER pass. PERSON and location-ish spans are
# unambiguous identifiers; DATE is included too since any date mentioned in
# prose (not just DOB) can be quasi-identifying in combination with other
# details. ORG is deliberately left alone — it would just as often catch a
# drug or device manufacturer mentioned in the findings as a hospital name,
# and over-redacting clinical content is its own kind of harm here.
_NER_LABELS_TO_REDACT = {"PERSON", "GPE", "LOC", "FAC", "DATE"}

_nlp = None


def _get_nlp():
    global _nlp
    if _nlp is None:
        _nlp = spacy.load("en_core_web_sm")
    return _nlp


def _redact_entities(text: str) -> str:
    doc = _get_nlp()(text)
    pieces = []
    cursor = 0
    for ent in doc.ents:
        if ent.label_ not in _NER_LABELS_TO_REDACT:
            continue
        pieces.append(text[cursor:ent.start_char])
        pieces.append("[REDACTED]")
        cursor = ent.end_char
    pieces.append(text[cursor:])
    return "".join(pieces)


def _redact_narrative_patient_name(text: str) -> str:
    def replace(match):
        # Skip "Patient Name:" itself — that's the field label, already
        # handled (and already redacted) by _FIELD_REGEX above. Only redact
        # narrative mentions like "Patient Jane Doe presents...".
        if re.match(r"\s*:", text[match.end():]):
            return match.group(0)
        return match.group(0).replace(match.group("name"), "[REDACTED]")

    return _NARRATIVE_PATIENT_NAME_REGEX.sub(replace, text)


def deidentify(text: str) -> str:
    text = dlp.redact(text)
    text = _FIELD_REGEX.sub(lambda m: f"{m.group('label')} [REDACTED]", text)
    text = _redact_narrative_patient_name(text)
    return _redact_entities(text)
