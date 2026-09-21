import json
import logging

from django.conf import settings
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

_client = None


def _get_client():
    """Vertex AI when VERTEX_PROJECT_ID is configured — authenticated via
    ADC (the Cloud Run runtime service account in prod, `gcloud auth
    application-default login` locally), BAA-eligible, and explicitly not
    used to train Google's models. Falls back to the plain API-key client
    otherwise, so contributors without GCP project access keep the existing
    free-tier local dev flow — same "optional locally, required in prod"
    pattern as documents/dlp.py.
    """
    global _client
    if _client is None:
        if settings.VERTEX_PROJECT_ID:
            _client = genai.Client(
                vertexai=True,
                project=settings.VERTEX_PROJECT_ID,
                location=settings.VERTEX_LOCATION,
            )
        else:
            _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client


def _get_model() -> str:
    if settings.VERTEX_PROJECT_ID:
        return settings.VERTEX_MODEL or settings.GEMINI_MODEL
    return settings.GEMINI_MODEL


LANGUAGE_NAMES = {
    "en": "English",
    "es": "Spanish",
    "zh-Hant": "Traditional Chinese",
}


def _generate_json(prompt: str, attempts: int = 2) -> dict:
    last_error = None
    for attempt in range(attempts):
        response = _get_client().models.generate_content(
            model=_get_model(),
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        try:
            return json.loads(response.text)
        except json.JSONDecodeError as exc:
            last_error = exc
            logger.warning("Gemini returned malformed JSON on attempt %d/%d: %s", attempt + 1, attempts, exc)
    raise last_error


def identify_findings(deidentified_text: str) -> dict:
    """Language-independent first pass: pick out findings a layperson would
    need explained, and describe them in the structured form PubMed retrieval
    needs. Returns {"context": {...}, "findings": [...]}.

    The model only proposes *pieces* — a canonical concept, synonyms, and the
    document's scan type / body region. pubmed.build_query assembles the
    actual boolean query (with its human-subjects / has-abstract filters) in
    code, so a bare, ambiguous term like "uptake" is searched as "FDG uptake"
    in a PET/CT context rather than as a naked word.

    Not the final annotation text — that comes from the grounded second pass,
    so this only needs to run once per document regardless of how many
    languages get requested later.
    """
    prompt = f"""You are helping a family member understand a medical scan report
or doctor's note. Below is the de-identified text of the document.

Step 1 - describe the document, using ONLY what the text itself states. Do
not diagnose or infer a condition the document does not name.
  "modality": the exam type as written (e.g. "PET/CT", "chest CT", "MRI
     brain", "complete blood count"), or "" if unclear
  "body_region": the anatomy or system examined (e.g. "chest", "abdomen and
     pelvis"), or "" if unclear

Step 2 - identify up to 10 key clinical findings, measurements, or terms
that a layperson would need explained. For each:
  "term": the exact term or phrase as it appears in the text (unchanged,
     same spelling and capitalization - it is used to find it in the document)
  "concept": the term as MEDICAL LITERATURE names it - a short noun phrase of
     1-4 words like a PubMed title or MeSH heading uses, NOT a plain-language
     description. Expand abbreviations and make generic one-word terms
     specific to this kind of exam. Examples: "SUVmax" -> "standardized
     uptake value"; "uptake" in a PET report -> "FDG uptake"; "right
     paratracheal lymph node" -> "paratracheal lymph node"; "mild
     hyponatremia" -> "hyponatremia"; "hypermetabolic" -> "FDG avidity". Do
     NOT add a diagnosis, cause, or organ the document does not state
     ("osteosclerotic lesions" -> "osteosclerotic bone lesions", never
     "osteosclerotic metastases"). If a term is a generic adjective with no
     searchable medical concept of its own (e.g. "physiologic", "normal"),
     use "" as its concept.
  "synonyms": 0-3 alternative names for the concept that medical literature
     uses, in English (use [] if none)
  "needs_context": true ONLY if the concept is a generic word or abbreviation
     whose meaning depends on the type of exam (e.g. "uptake", "SUV",
     "lesion", "enhancement"); false for a specific named condition,
     structure, or lab finding (e.g. "hyponatremia", "leukocytosis",
     "paratracheal lymph node")

Respond with strict JSON only, in this shape:
{{"context": {{"modality": "...", "body_region": "..."}},
  "findings": [{{"term": "...", "concept": "...", "synonyms": ["..."], "needs_context": false}}]}}

Document text:
---
{deidentified_text}
---"""
    result = _generate_json(prompt)
    context = result.get("context") or {}
    return {
        "context": {
            "modality": str(context.get("modality") or "").strip(),
            "body_region": str(context.get("body_region") or "").strip(),
        },
        "findings": result.get("findings", []),
    }


def describe_term(term: str, context: dict) -> dict:
    """The on-demand path's counterpart to identify_findings' per-finding
    fields: a reader's own selection ("SUV", "hyponatremia") has no
    model-refined concept yet, and searching PubMed for the raw selected text
    is exactly the weak-query problem identify_findings solves for the
    automatic picks. Only the (already de-identified-safe) scan context is
    sent, not the document.
    """
    prompt = f"""A reader of a medical report selected the term "{term}". The exam is
"{context.get("modality", "")}" of "{context.get("body_region", "")}" (either may be blank).

Describe it for a literature search. Respond with strict JSON only:
{{"concept": "...", "synonyms": ["..."], "needs_context": false}}

  "concept": the term as MEDICAL LITERATURE names it - a short noun phrase of
     1-4 words like a PubMed title or MeSH heading uses, NOT a plain-language
     description ("SUVmax" -> "standardized uptake value"). Do NOT add a
     diagnosis, cause, or organ that was not stated. "" if it is a generic
     adjective with no searchable medical concept.
  "synonyms": 0-3 alternative names medical literature uses ([] if none)
  "needs_context": true ONLY if the term is a generic word or abbreviation
     whose meaning depends on the type of exam (e.g. "uptake", "SUV",
     "lesion"); false for a specific named condition, structure, or lab
     finding"""
    result = _generate_json(prompt)
    return {
        "concept": str(result.get("concept") or "").strip() or term,
        "synonyms": [s for s in (result.get("synonyms") or []) if isinstance(s, str)][:3],
        "needs_context": bool(result.get("needs_context")),
    }


def grade_candidates(graded_input: list[dict]) -> list[list[dict]]:
    """Relevance gate between retrieval and generation: for each term, judge
    which of its retrieved PubMed candidates are actually about that concept,
    in the context of this document. PubMed's search and the code-side rerank
    can only go so far on ambiguous terms; this is the check that catches a
    paper that merely contains the words.

    graded_input: [{"term", "concept", "context", "candidates": [{"pmid",
    "title", "abstract"}]}], where "context" is a non-empty exam description
    only for terms whose meaning depends on it (needs_context) — for a
    specific named condition it is left empty, so a paper on that condition is
    never rejected merely for not being about the exam type. Returns, per input entry (same order), a list of
    {"pmid", "relevance": "yes"|"tangential"|"no", "human_subjects": bool}.
    Indexed by position rather than term text so a reworded term can't
    misalign the results.
    """
    payload = [
        {
            "index": i,
            "term": entry["term"],
            "concept": entry["concept"],
            "exam_context": entry.get("context") or "(not needed for this term)",
            "candidates": [
                {"pmid": c["pmid"], "title": c["title"], "abstract": c["abstract"][:1200]}
                for c in entry["candidates"]
            ],
        }
        for i, entry in enumerate(graded_input)
    ]
    prompt = f"""You are screening PubMed papers for a tool that explains medical
reports to patients. For each item below, decide whether each candidate paper
is genuinely ABOUT the item's medical concept. Where an item gives an
"exam_context", use it only to pin down what a generic term means (e.g.
"uptake" in a PET/CT report means FDG uptake) - do not require the paper to be
about that exam type; a good paper on the concept itself qualifies.

For every candidate give:
  "relevance": "yes" only if the concept ITSELF is the paper's central
     subject and reading it would help a patient understand what the concept
     is, how it is measured, or what it signifies - an overview, review,
     guideline, or a study focused on the concept. "tangential" if the concept
     is merely used, reported, or applied inside a study of something else
     (e.g. a paper on one specific cancer that happens to report the finding).
     "no" if it is unrelated, uses the word in a different sense, or is not
     about the concept.
  "human_subjects": true only if the paper studies human patients or human
     data; false for animal, cell-culture, veterinary, or purely
     computational/phantom work.

Be strict. When in doubt, choose "tangential" or "no".

Respond with strict JSON only, in this shape:
{{"grades": [{{"index": 0, "candidates": [{{"pmid": "...", "relevance": "yes", "human_subjects": true}}]}}]}}

Items:
{json.dumps(payload, indent=2)}"""
    result = _generate_json(prompt)

    by_index = {}
    for entry in result.get("grades", []):
        try:
            by_index[int(entry.get("index"))] = entry.get("candidates", [])
        except (TypeError, ValueError):
            continue
    return [by_index.get(i, []) for i in range(len(graded_input))]


def explain_term(term_with_candidates: dict, deidentified_text: str, language: str = "en") -> dict:
    """On-demand counterpart to generate_annotations, for one ad-hoc term the
    reader selected in the document themselves rather than one
    identify_findings picked automatically. Same grounding rule applies —
    the model may only cite PMIDs from term_with_candidates["candidates"],
    never invent one.
    """
    language_name = LANGUAGE_NAMES.get(language, language)
    term = term_with_candidates["term"]
    prompt = f"""Write your entire response in {language_name}.

You are helping a family member understand a medical scan report or doctor's
note. Below is the de-identified document text, followed by one specific
term or phrase the reader selected themselves and wants explained, along
with candidate PubMed sources for it.

Write a plain-language explanation (as if explaining to a 10-year-old) of
what "{term}" means in the context of this document. You may ONLY cite
PubMed sources from the "candidates" list below — never invent a PMID or
cite one that isn't listed.

A citation must be backed by evidence: for each one, copy an
"evidence_quote" — a sentence or fragment taken VERBATIM, word for word,
from that candidate's abstract, which supports what your explanation says
about the term. Do not paraphrase or fix the quote. A citation whose quote
does not appear exactly in that abstract is discarded, so a weak or
tangential paper is worse than none: if no candidate's abstract genuinely
supports your explanation, leave "citations" empty and still explain the
term in general plain language without a citation.

Respond with strict JSON only, in this shape:
{{"explanation": "...", "citations": [{{"pmid": "...", "evidence_quote": "..."}}]}}

Document text:
---
{deidentified_text}
---

Term to explain: "{term}"
Candidate sources:
{json.dumps(term_with_candidates["candidates"], indent=2)}"""
    return _generate_json(prompt)


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
that isn't listed.

A citation must be backed by evidence: for each one, copy an
"evidence_quote" — a sentence or fragment taken VERBATIM, word for word,
from that candidate's abstract, which supports what your explanation says
about the finding. Do not paraphrase or fix the quote. A citation whose quote
does not appear exactly in that abstract is discarded, so a weak or
tangential paper is worse than none: if no candidate's abstract genuinely
supports your explanation of a finding, leave its "citations" empty and
still explain the term in general plain language without a citation.

Keep each "term" field exactly as given below — do not translate it — so it
stays findable in the source document.

Respond with strict JSON only, in this shape:
{{"summary": "...", "items": [{{"term": "...", "explanation": "...", "citations": [{{"pmid": "...", "evidence_quote": "..."}}]}}]}}

Document text:
---
{deidentified_text}
---

Findings and their candidate sources:
{json.dumps(findings_with_candidates, indent=2)}"""
    return _generate_json(prompt)
