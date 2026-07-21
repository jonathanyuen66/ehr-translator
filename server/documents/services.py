import logging

import pdfplumber

from . import gemini, pubmed
from .deidentify import deidentify

logger = logging.getLogger(__name__)


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
    candidates_by_term = {
        f["term"]: {c["pmid"]: c for c in f["candidates"]} for f in findings_with_candidates
    }
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
        valid_candidates = candidates_by_term.get(term, {})
        citations = []
        for citation in item.get("citations", []):
            match = valid_candidates.get(str(citation.get("pmid", "")))
            if match:
                citations.append({"pmid": match["pmid"], "title": match["title"], "url": match["url"]})
            else:
                logger.warning("Dropping unverified citation %r for term %r", citation, term)

        validated_items.append(
            {
                "term": term,
                "explanation": item.get("explanation", ""),
                "source_found": bool(citations),
                "citations": citations,
            }
        )

    return {"summary": result.get("summary", ""), "items": validated_items}
