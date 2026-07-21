import re

# Best-effort redaction of labeled identifier fields commonly found in EHR/scan
# report headers (e.g. "Patient Name: Jane Doe" -> "Patient Name: [REDACTED]").
# This is a heuristic, not a guarantee — free-text reports vary in format and
# an identifier phrased unusually could slip through. It exists as a mitigation
# for using the Gemini free tier, whose terms allow using inputs to improve
# Google's products; it is not a substitute for careful review before this
# handles anyone else's real records.
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


def deidentify(text: str) -> str:
    return _FIELD_REGEX.sub(lambda m: f"{m.group('label')} [REDACTED]", text)
