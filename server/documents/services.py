import logging

import pdfplumber

from . import gemini, pubmed
from .deidentify import deidentify
from .models import Annotation

logger = logging.getLogger(__name__)


class PersonalInfoSelected(Exception):
    """Raised by explain_ad_hoc_term when the selected text itself looks
    like personal information, rather than a clinical term."""


def _validate_citations(citations: list[dict], candidates: list[dict], term: str) -> list[dict]:
    """Re-checks the model's cited PMIDs against the real, retrieved
    candidates — it's never trusted on its own to have only cited what it
    was given, since that's the whole point of the retrieval-then-generation
    split (gemini.generate_annotations / gemini.explain_term).
    """
    valid_candidates = {c["pmid"]: c for c in candidates}
    validated = []
    for citation in citations:
        match = valid_candidates.get(str(citation.get("pmid", "")))
        if match:
            validated.append({"pmid": match["pmid"], "title": match["title"], "url": match["url"]})
        else:
            logger.warning("Dropping unverified citation %r for term %r", citation, term)
    return validated


def extract_text(file_field) -> str:
    """Extract text from a Django FileField's underlying PDF, page by page."""
    file_field.open("rb")
    try:
        with pdfplumber.open(file_field) as pdf:
            pages_text = [page.extract_text() or "" for page in pdf.pages]
    finally:
        file_field.close()
    return "\n\n".join(pages_text).strip()


def build_findings_with_candidates(extracted_text: str) -> list[dict]:
    """Language-independent pass: identify findings in the report and gather
    real PubMed candidates for each. The result is cached on
    Document.findings so switching the annotation language later only needs
    one more Gemini call, not a full re-run of this (and the PubMed lookups).
    """
    deidentified = deidentify(extracted_text)
    findings = gemini.identify_findings(deidentified)

    findings_with_candidates = []
    for finding in findings:
        term = finding.get("term", "")
        candidates = pubmed.search(finding.get("pubmed_query", term), max_results=3)
        findings_with_candidates.append({"term": term, "candidates": candidates})
    return findings_with_candidates


def build_annotations_for_language(extracted_text: str, findings_with_candidates: list[dict], language: str) -> dict:
    """Generate a grounded, plain-language summary + per-finding explanations
    in one language. Citations are re-validated against the real PubMed
    candidates after the model responds — it's never trusted on its own to
    have only cited what it was given.
    """
    if not findings_with_candidates:
        return {"summary": "", "items": []}

    deidentified = deidentify(extracted_text)
    candidates_by_term = {f["term"]: f["candidates"] for f in findings_with_candidates}
    gemini_input = [
        {
            "term": f["term"],
            "candidates": [
                {"pmid": c["pmid"], "title": c["title"], "abstract": c["abstract"]}
                for c in f["candidates"]
            ],
        }
        for f in findings_with_candidates
    ]

    result = gemini.generate_annotations(gemini_input, deidentified, language=language)

    validated_items = []
    for item in result.get("items", []):
        term = item.get("term", "")
        candidates = candidates_by_term.get(term, [])
        citations = _validate_citations(item.get("citations", []), candidates, term)
        validated_items.append(
            {
                "term": term,
                "explanation": item.get("explanation", ""),
                "source_found": bool(citations),
                "citations": citations,
            }
        )

    return {"summary": result.get("summary", ""), "items": validated_items}


def explain_ad_hoc_term(document, term: str, language: str) -> dict:
    """The on-demand counterpart to the two functions above: explains one
    term the reader selected in the document themselves (DocumentViewSet.explain),
    rather than one identify_findings picked automatically at upload time.

    Persists the result so it behaves exactly like any other finding from
    then on — it gets added to document.findings (so a not-yet-generated
    language's annotations include it as context too) and to the current
    language's cached Annotation.items (so the document viewer's existing
    term-highlighting picks it up without any special-casing on the frontend).
    """
    term = term.strip()
    annotation, _ = Annotation.objects.get_or_create(document=document, language=language)

    # Already explained (e.g. asked before, or it happened to be one of
    # identify_findings's own picks) — reuse it rather than paying for
    # another Gemini + PubMed round trip for the same term. Re-checked
    # against the safety net below rather than trusted outright: a cached
    # entry could in principle predate this check (a bug, a manual DB edit,
    # whatever) — a cache is not itself a safety net, so it doesn't get to
    # keep re-serving something that check would refuse today.
    cached = next(
        (i for i in annotation.items if i.get("term", "").strip().lower() == term.lower()), None
    )
    if cached is not None and deidentify(cached["term"]) == cached["term"]:
        return cached
    if cached is not None:
        logger.warning("Purging stale/corrupted cached explanation for term %r", term)
        annotation.items = [i for i in annotation.items if i is not cached]
        annotation.save(update_fields=["items"])
        document.findings = [
            f for f in document.findings if f.get("term", "").strip().lower() != term.lower()
        ]
        document.save(update_fields=["findings"])

    # Unlike the automatic pipeline (identify_findings only ever sees
    # deidentify()'d text, so it can never propose a raw identifier as a
    # "finding" in the first place), the reader can select literally
    # anything in the original, un-redacted document — including their own
    # name or DOB. Run the exact same redaction pipeline over the selection
    # itself: if it would redact anything at all, treat that as personal
    # information and refuse, before term ever reaches PubMed or Gemini.
    if deidentify(term) != term:
        raise PersonalInfoSelected(term)

    deidentified = deidentify(document.extracted_text)
    candidates = pubmed.search(term, max_results=3)
    result = gemini.explain_term({"term": term, "candidates": candidates}, deidentified, language=language)
    citations = _validate_citations(result.get("citations", []), candidates, term)

    item = {
        "term": term,
        "explanation": result.get("explanation", ""),
        "source_found": bool(citations),
        "citations": citations,
    }

    if not any(f.get("term", "").strip().lower() == term.lower() for f in document.findings):
        document.findings = document.findings + [{"term": term, "candidates": candidates}]
        document.save(update_fields=["findings"])

    annotation.items = annotation.items + [item]
    annotation.save(update_fields=["items"])

    return item
