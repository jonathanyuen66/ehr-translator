import io
import logging

import pdfplumber
import pillow_heif
from PIL import Image

from . import gemini, pubmed, translate, vision
from .deidentify import deidentify
from .models import Annotation

logger = logging.getLogger(__name__)

# Lets Pillow open HEIC/HEIF (the default format for iPhone photos) the same
# way it already opens JPEG/PNG — registered once at import time.
pillow_heif.register_heif_opener()

_IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".heic", ".heif")


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
    """Extract text from a Django FileField, routing to whichever extractor
    matches the upload — a PDF's own text layer via pdfplumber, or Cloud
    Vision OCR for a photographed/scanned image. The extension has already
    been validated by DocumentSerializer.validate_file by the time this
    runs, so it's a safe dispatch key here.
    """
    name = (file_field.name or "").lower()
    if name.endswith(_IMAGE_EXTENSIONS):
        return _extract_text_from_image(file_field)
    return _extract_text_from_pdf(file_field)


def _extract_text_from_pdf(file_field) -> str:
    file_field.open("rb")
    try:
        with pdfplumber.open(file_field) as pdf:
            pages_text = [page.extract_text() or "" for page in pdf.pages]
    finally:
        file_field.close()
    return "\n\n".join(pages_text).strip()


def _extract_text_from_image(file_field) -> str:
    # Normalized to plain JPEG bytes regardless of source format — Cloud
    # Vision doesn't accept HEIC/HEIF directly, and re-encoding every format
    # through the same path (rather than branching HEIC vs. everything
    # else) keeps this to one code path instead of two.
    file_field.open("rb")
    try:
        image = Image.open(file_field)
        image = image.convert("RGB")
        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=92)
    finally:
        file_field.close()
    return vision.extract_text(buffer.getvalue())


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


def _generate_english_annotations(extracted_text: str, findings_with_candidates: list[dict]) -> dict:
    """The one Gemini generation pass per document: a grounded,
    plain-language summary + per-finding explanations, always in English.
    Every other language's Annotation is *derived* from this one via
    translation (_translate_annotations / get_or_create_annotation below),
    never generated independently — see the note on _translate_annotations
    for why. Citations are re-validated against the real PubMed candidates
    after the model responds — it's never trusted on its own to have only
    cited what it was given.
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

    result = gemini.generate_annotations(gemini_input, deidentified, language="en")

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


def _translate_annotations(english: dict, language: str) -> dict:
    """Derives a non-English Annotation's content from the canonical English
    one via Cloud Translation (documents/translate.py) instead of a second,
    independent Gemini generation — cheaper, near-instant, and (the actual
    point) guaranteed to describe the same findings the same way in every
    language, rather than risking a second LLM pass that subtly diverges in
    what it chooses to emphasize.

    `term` is passed through completely unchanged: it has to stay the exact
    string extracted from the source document, or highlighting in the
    document viewer breaks (gemini.py's own prompt already enforces this for
    the English pass — translating it here would undo that). Citation titles
    are already the real PubMed paper's own title regardless of annotation
    language, so those pass through unchanged too. Only `summary` and each
    item's `explanation` are actual prose that needs translating — sent as
    one batch request rather than one call per string.
    """
    if not english["items"] and not english["summary"]:
        return {"summary": "", "items": []}

    texts = [english["summary"]] + [item["explanation"] for item in english["items"]]
    translated_summary, *translated_explanations = translate.translate_texts(texts, language)

    items = [
        {**item, "explanation": explanation}
        for item, explanation in zip(english["items"], translated_explanations)
    ]
    return {"summary": translated_summary, "items": items}


def get_or_create_annotation(document, language: str) -> Annotation:
    """Returns the cached Annotation for `language`, generating (and
    caching) it first if this is the first time it's been asked for — via
    Gemini for English, or via translation of the (also generated-if-missing)
    English Annotation for anything else. Requires document.findings to
    already be populated (build_findings_with_candidates, run once per
    document regardless of language).

    This is what makes switching languages instant after the first request:
    translation is the only extra work involved, and it's cheap and fast
    enough that DocumentViewSet.perform_create also does it eagerly for
    every supported language right after upload, rather than waiting for a
    reader to actually ask for Spanish or Traditional Chinese.
    """
    annotation = Annotation.objects.filter(document=document, language=language).first()
    if annotation is not None:
        return annotation

    english = Annotation.objects.filter(document=document, language="en").first()
    if english is None:
        result = _generate_english_annotations(document.extracted_text, document.findings)
        english, _ = Annotation.objects.update_or_create(
            document=document,
            language="en",
            defaults={"summary": result["summary"], "items": result["items"]},
        )

    if language == "en":
        return english

    result = _translate_annotations({"summary": english.summary, "items": english.items}, language)
    annotation, _ = Annotation.objects.update_or_create(
        document=document,
        language=language,
        defaults={"summary": result["summary"], "items": result["items"]},
    )
    return annotation


def _find_cached_explanation(annotation: Annotation, term: str) -> dict | None:
    return next(
        (i for i in annotation.items if i.get("term", "").strip().lower() == term.strip().lower()), None
    )


def _append_explanation(document, language: str, item: dict) -> None:
    annotation, _ = Annotation.objects.get_or_create(document=document, language=language)
    annotation.items = annotation.items + [item]
    annotation.save(update_fields=["items"])


def _purge_stale_explanation(document, term: str) -> None:
    """Scrubs a term from every cached language, not just whichever one it
    was first noticed in — a stale/corrupted entry that predates the
    personal-info safety check wouldn't have been caught for *any* language
    at the time, since every language's copy ultimately traces back to the
    same English generation (see explain_ad_hoc_term below).
    """
    term_lower = term.strip().lower()
    for annotation in Annotation.objects.filter(document=document):
        before = len(annotation.items)
        annotation.items = [i for i in annotation.items if i.get("term", "").strip().lower() != term_lower]
        if len(annotation.items) != before:
            annotation.save(update_fields=["items"])
    document.findings = [f for f in document.findings if f.get("term", "").strip().lower() != term_lower]
    document.save(update_fields=["findings"])


def explain_ad_hoc_term(document, term: str, language: str) -> dict:
    """The on-demand counterpart to the two functions above: explains one
    term the reader selected in the document themselves (DocumentViewSet.explain),
    rather than one identify_findings picked automatically at upload time.

    Unified with the same English-canonical, translate-everything-else
    approach as get_or_create_annotation: the explanation is generated by
    Gemini exactly once, always in English, then propagated via Cloud
    Translation to every language this document already has a cached
    Annotation for — not independently regenerated per language. That's
    what keeps an ad-hoc explanation consistent (and immediately available)
    across a language switch, the same guarantee the automatic findings
    already have, rather than only existing in whichever language the
    reader happened to be viewing when they asked.

    Persists the result so it behaves exactly like any other finding from
    then on — it gets added to document.findings (so a not-yet-generated
    language's annotations include it as context too) and to every touched
    language's cached Annotation.items (so the document viewer's existing
    term-highlighting picks it up without any special-casing on the frontend).
    A language nobody has generated annotations for yet is left alone rather
    than forced into existence here.
    """
    term = term.strip()
    requested_annotation, _ = Annotation.objects.get_or_create(document=document, language=language)

    # Already explained (e.g. asked before, or it happened to be one of
    # identify_findings's own picks) — reuse it rather than paying for
    # another Gemini + PubMed + Translate round trip for the same term.
    # Re-checked against the safety net below rather than trusted outright:
    # a cached entry could in principle predate this check (a bug, a manual
    # DB edit, whatever) — a cache is not itself a safety net, so it doesn't
    # get to keep re-serving something that check would refuse today.
    cached = _find_cached_explanation(requested_annotation, term)
    if cached is not None and deidentify(cached["term"]) == cached["term"]:
        return cached
    if cached is not None:
        logger.warning("Purging stale/corrupted cached explanation for term %r", term)
        _purge_stale_explanation(document, term)

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

    # Always generated in English, then translated — same rule as
    # get_or_create_annotation, and for the same reason: one Gemini call
    # total instead of one per language, and every language ends up
    # describing the term identically instead of risking a second,
    # independent generation that phrases it differently.
    result = gemini.explain_term({"term": term, "candidates": candidates}, deidentified, language="en")
    citations = _validate_citations(result.get("citations", []), candidates, term)
    english_item = {
        "term": term,
        "explanation": result.get("explanation", ""),
        "source_found": bool(citations),
        "citations": citations,
    }
    _append_explanation(document, "en", english_item)

    if not any(f.get("term", "").strip().lower() == term.lower() for f in document.findings):
        document.findings = document.findings + [{"term": term, "candidates": candidates}]
        document.save(update_fields=["findings"])

    requested_item = english_item
    # Every language this document already has an Annotation for (including
    # `language` itself, just get_or_create'd above) gets the translated
    # explanation right away — not just whichever one the reader happened to
    # be viewing when they asked.
    other_languages = Annotation.objects.filter(document=document).exclude(language="en").values_list(
        "language", flat=True
    )
    for other_language in other_languages:
        translated_explanation = translate.translate_texts([english_item["explanation"]], other_language)[0]
        translated_item = {**english_item, "explanation": translated_explanation}
        _append_explanation(document, other_language, translated_item)
        if other_language == language:
            requested_item = translated_item

    return requested_item
