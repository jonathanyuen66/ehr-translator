import json
import logging

from django.conf import settings
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client


LANGUAGE_NAMES = {
    "en": "English",
    "es": "Spanish",
    "zh-Hant": "Traditional Chinese",
}


def _generate_json(prompt: str, attempts: int = 2) -> dict:
    last_error = None
    for attempt in range(attempts):
        response = _get_client().models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        try:
            return json.loads(response.text)
        except json.JSONDecodeError as exc:
            last_error = exc
            logger.warning("Gemini returned malformed JSON on attempt %d/%d: %s", attempt + 1, attempts, exc)
    raise last_error


def identify_findings(deidentified_text: str) -> list[dict]:
    """Language-independent first pass: pick out findings a layperson would
    need explained and propose PubMed search keywords for each. Not the final
    annotation text yet — that comes from the grounded, per-language second
    pass, so this only needs to run once per document regardless of how many
    languages get requested later.
    """
    prompt = f"""You are helping a family member understand a medical scan report
or doctor's note. Below is the de-identified text of the document.

Identify up to 6 key clinical findings, measurements, or terms that a
layperson would need explained. For each finding, give the exact term or
phrase as it appears in the text, and 2-4 concise PubMed search keywords
(in English, since that's what PubMed indexes) that would find relevant
literature about it.

Respond with strict JSON only, in this shape:
{{"findings": [{{"term": "...", "pubmed_query": "..."}}]}}

Document text:
---
{deidentified_text}
---"""
    result = _generate_json(prompt)
    return result.get("findings", [])


def generate_annotations(findings_with_candidates: list[dict], deidentified_text: str, language: str = "en") -> dict:
    """Second pass: write a grounded, plain-language summary and per-finding
    explanations in the requested language. The model may only cite PMIDs
    from the candidate list handed to it here — it's never given the freedom
    to invent a citation, since that's the whole point of the
    retrieval-then-generation split. (Citations are re-validated against the
    real candidates again in services.py, after this returns.)
    """
    language_name = LANGUAGE_NAMES.get(language, language)
    prompt = f"""Write your entire response in {language_name}.

You are helping a family member understand a medical scan report or doctor's
note. Below is the de-identified document text, followed by a list of key
findings with candidate PubMed sources for each.

First, write a one-paragraph plain-language overall summary of the document,
as if explaining it to a 10-year-old.

Then, for each finding, write a plain-language explanation (as if explaining
to a 10-year-old) of what it means. You may ONLY cite PubMed sources from
that finding's own "candidates" list below — never invent a PMID or cite one
that isn't listed. If none of the candidates are actually relevant to the
finding, leave "citations" empty and still explain the term in general plain
language without a citation. Keep each "term" field exactly as given below —
do not translate it — so it stays findable in the source document.

Respond with strict JSON only, in this shape:
{{"summary": "...", "items": [{{"term": "...", "explanation": "...", "citations": [{{"pmid": "...", "title": "..."}}]}}]}}

Document text:
---
{deidentified_text}
---

Findings and their candidate sources:
{json.dumps(findings_with_candidates, indent=2)}"""
    return _generate_json(prompt)
