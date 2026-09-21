import datetime
import logging
import re
import time
import xml.etree.ElementTree as ET

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

ESEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
EFETCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"

_RETRY_DELAYS = (1, 2, 4)  # seconds; NCBI's without-a-key limit is 3 req/sec

# How many PMIDs to pull per term before reranking, and how many survive the
# rerank to be handed to the (LLM) relevance gate in services.py. Wider than
# the 3 that finally get cited because PubMed's own "relevance" sort is a
# weak signal on its own — the rerank below is what picks the good ones.
POOL_SIZE = 12
KEEP_AFTER_RERANK = 6
# A search tier that returns fewer than this many PMIDs is treated as too
# narrow, and the next (looser) tier is tried instead.
MIN_POOL = 3
# Extra PMIDs pulled with the same query restricted to reviews / guidelines.
# A reader asking "what is X?" is best served by an explanatory paper, but
# PubMed's relevance order is dominated by narrow original studies, so the
# rerank alone has nothing good to promote unless reviews are in the pool.
REVIEW_POOL_SIZE = 6
_REVIEW_FILTER = (
    '("review"[Publication Type] OR "systematic review"[Publication Type] OR '
    '"meta-analysis"[Publication Type] OR "practice guideline"[Publication Type] OR '
    '"guideline"[Publication Type])'
)

# Full abstracts, not a preview: services._verify_citations checks the
# model's quoted evidence against this exact text, so truncating it mid-paper
# would reject a genuine quote from the cut-off half. ~3000 chars covers
# essentially every structured abstract.
ABSTRACT_MAX_CHARS = 3000


def _get_with_retry(url: str, params: dict) -> requests.Response:
    for attempt, delay in enumerate((*_RETRY_DELAYS, None)):
        resp = requests.get(url, params=params, timeout=10)
        if resp.status_code != 429 and resp.status_code < 500:
            resp.raise_for_status()
            return resp
        if delay is None:
            resp.raise_for_status()
            return resp
        logger.warning("PubMed request throttled (status %s), retrying in %ss", resp.status_code, delay)
        time.sleep(delay)


def _clean(text: str) -> str:
    """Strips characters that are PubMed query syntax, so text that came
    from a model can't alter the boolean structure built in code."""
    return re.sub(r'["\[\]()]', " ", text or "").strip()


def _phrase(text: str) -> str:
    return f'"{" ".join(_clean(text).split())}"[Title/Abstract]'


def build_query(spec: dict, tier: int = 0) -> str:
    """Assembles the PubMed boolean query in code from structured pieces,
    rather than trusting a model-written keyword string — the filters (human
    subjects, has an abstract, English) are what keep a bare concept like
    "uptake" from returning mouse-model or veterinary papers, and they need
    to be guaranteed, not suggested.

    Tiers loosen progressively when a stricter one finds too little:
      0  concept AND scan/body-region context AND filters (only ever tried
         for terms flagged needs_context — see _search_pmids)
      1  concept AND filters
      2  concept AND has-abstract (last resort — the rerank then penalizes
         animal-only records instead of the query excluding them)
    """
    names = [spec.get("concept") or spec.get("term", "")] + list(spec.get("synonyms") or [])
    seen, phrases = set(), []
    for name in names:
        cleaned = " ".join(_clean(name).split())
        if cleaned and cleaned.lower() not in seen:
            seen.add(cleaned.lower())
            phrases.append(_phrase(cleaned))
    if not phrases:
        return ""
    concept_clause = "(" + " OR ".join(phrases) + ")"

    clauses = [concept_clause]
    if tier == 0:
        context = spec.get("context") or {}
        context_phrases = [_phrase(context[k]) for k in ("modality", "body_region") if _clean(context.get(k, ""))]
        if context_phrases:
            clauses.append("(" + " OR ".join(context_phrases) + ")")
    if tier <= 1:
        clauses += ["hasabstract", "english[Language]", "humans[MeSH Terms]"]
    else:
        clauses += ["hasabstract"]
    return " AND ".join(clauses)


def _esearch(query: str, retmax: int) -> list[str]:
    params = {
        "db": "pubmed",
        "term": query,
        "retmax": retmax,
        "sort": "relevance",
        "retmode": "json",
        "tool": "ehr-translator",
    }
    if settings.PUBMED_API_KEY:
        params["api_key"] = settings.PUBMED_API_KEY
    resp = _get_with_retry(ESEARCH_URL, params)
    return resp.json().get("esearchresult", {}).get("idlist", [])


def _search_pmids(spec: dict) -> list[str]:
    """Runs the tiers strictest-first and stops at the first that finds
    enough — so a term with real context-specific literature gets that, and
    only a term that has none falls back to the broader net.

    Scan context is only used for terms the model flagged needs_context: a
    generic word or abbreviation whose meaning depends on the exam ("uptake",
    "SUV", "lesion"). For a specific named condition ("hyponatremia") adding
    "metabolic panel" to the query only drags in unrelated papers, so it
    starts at the no-context tier. Either way, a reviews/guidelines-only
    variant of the winning query is unioned in.
    """
    tiers = (0, 1, 2) if spec.get("needs_context") else (1, 2)
    best_tier, best = tiers[-1], []
    for tier in tiers:
        query = build_query(spec, tier)
        if not query:
            return []
        pmids = _esearch(query, POOL_SIZE)
        if len(pmids) >= MIN_POOL:
            best_tier, best = tier, pmids
            break
        if len(pmids) > len(best):
            best_tier, best = tier, pmids

    if best:
        reviews = _esearch(f"{build_query(spec, best_tier)} AND {_REVIEW_FILTER}", REVIEW_POOL_SIZE)
        best = best + [p for p in reviews if p not in best]
    return best


_STUDY_TYPES = (
    # (label key, PublicationType substrings), strongest evidence first
    ("meta_analysis", ("meta-analysis",)),
    ("systematic_review", ("systematic review",)),
    ("guideline", ("practice guideline", "guideline", "consensus development")),
    ("review", ("review",)),
    ("clinical_trial", ("clinical trial", "randomized controlled trial")),
    ("case_report", ("case reports",)),
)
_LOW_VALUE_TYPES = ("comment", "editorial", "letter", "news", "retracted publication", "published erratum")


def _study_type(pub_types: list[str]) -> str | None:
    lowered = [p.lower() for p in pub_types]
    for key, needles in _STUDY_TYPES:
        if any(n in p for p in lowered for n in needles):
            return key
    return None


def _parse_year(article) -> int | None:
    for path in (".//JournalIssue/PubDate/Year", ".//ArticleDate/Year", ".//PubMedPubDate/Year"):
        el = article.find(path)
        if el is not None and el.text and el.text.strip().isdigit():
            return int(el.text.strip())
    medline = article.find(".//JournalIssue/PubDate/MedlineDate")
    if medline is not None and medline.text:
        match = re.search(r"(19|20)\d{2}", medline.text)
        if match:
            return int(match.group(0))
    return None


def _fetch_details(pmids: list[str]) -> dict[str, dict]:
    """One efetch for every PMID across every term in a document — the
    per-term esearches can't be merged, but the (larger) detail fetch can.
    Returns pmid -> candidate."""
    if not pmids:
        return {}
    params = {
        "db": "pubmed",
        "id": ",".join(pmids),
        "rettype": "abstract",
        "retmode": "xml",
        "tool": "ehr-translator",
    }
    if settings.PUBMED_API_KEY:
        params["api_key"] = settings.PUBMED_API_KEY

    resp = _get_with_retry(EFETCH_URL, params)
    return parse_articles(resp.content)


def parse_articles(xml_bytes: bytes) -> dict[str, dict]:
    root = ET.fromstring(xml_bytes)
    results = {}
    for article in root.findall(".//PubmedArticle"):
        pmid_el = article.find(".//PMID")
        if pmid_el is None or not pmid_el.text:
            continue
        pmid = pmid_el.text.strip()

        title_el = article.find(".//ArticleTitle")
        title = "".join(title_el.itertext()).strip() if title_el is not None else ""

        abstract_parts = article.findall(".//AbstractText")
        abstract = " ".join("".join(p.itertext()).strip() for p in abstract_parts).strip()

        pub_types = [
            (p.text or "").strip() for p in article.findall(".//PublicationTypeList/PublicationType")
        ]
        mesh = {
            (d.text or "").strip().lower() for d in article.findall(".//MeshHeadingList/MeshHeading/DescriptorName")
        }

        results[pmid] = {
            "pmid": pmid,
            "title": title,
            "abstract": abstract[:ABSTRACT_MAX_CHARS],
            "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
            "study_type": _study_type(pub_types),
            "pub_types": pub_types,
            "year": _parse_year(article),
            "is_human": "humans" in mesh,
            "is_animal": "animals" in mesh,
        }
    return results


_STOPWORDS = {"with", "from", "that", "this", "of", "and", "the", "for", "in", "on", "to"}


def _tokens(text: str) -> set[str]:
    return {t for t in re.findall(r"[a-z0-9]+", (text or "").lower()) if len(t) >= 4 and t not in _STOPWORDS}


def score_candidate(candidate: dict, spec: dict) -> float:
    """Deterministic rerank signal on top of PubMed's own ordering: prefer
    human, higher-evidence, recent work that visibly talks about the concept;
    push down animal-only papers and commentary. Pure function so it's
    unit-testable without any network."""
    score = 0.0

    study_type = candidate.get("study_type")
    score += {
        "meta_analysis": 2.5,
        "guideline": 2.5,
        "systematic_review": 2.0,
        "review": 1.5,
        "clinical_trial": 0.5,
        "case_report": -1.0,
    }.get(study_type, 0.0)
    if any(any(low in p.lower() for low in _LOW_VALUE_TYPES) for p in candidate.get("pub_types", [])):
        score -= 2.0

    if candidate.get("is_human"):
        score += 1.0
    if candidate.get("is_animal") and not candidate.get("is_human"):
        score -= 3.0

    year = candidate.get("year")
    if year and year >= datetime.date.today().year - 10:
        score += 0.5

    names = [spec.get("concept") or spec.get("term", "")] + list(spec.get("synonyms") or [])
    concept_tokens = set().union(*(_tokens(n) for n in names)) if names else set()
    if concept_tokens:
        title_hits = len(concept_tokens & _tokens(candidate.get("title", ""))) / len(concept_tokens)
        abstract_hits = len(concept_tokens & _tokens(candidate.get("abstract", ""))) / len(concept_tokens)
        score += 2.0 * title_hits + 1.0 * abstract_hits
    return score


def search_many(specs: list[dict]) -> list[list[dict]]:
    """Retrieves and reranks candidate papers for every term spec in one go.

    Each spec: {"term", "concept", "synonyms", "context": {modality, body_region}}.
    Returns one list per spec (same order), each up to KEEP_AFTER_RERANK
    candidates with study type / year / human-subject metadata attached.
    These are still only *candidates* — services.py grades their relevance
    and verifies quoted support before anything is cited.
    """
    pmids_per_spec = [_search_pmids(spec) for spec in specs]
    details = _fetch_details(sorted({p for pmids in pmids_per_spec for p in pmids}))

    results = []
    for spec, pmids in zip(specs, pmids_per_spec):
        candidates = [details[p] for p in pmids if p in details and details[p]["abstract"]]
        candidates.sort(key=lambda c: score_candidate(c, spec), reverse=True)
        results.append(candidates[:KEEP_AFTER_RERANK])
    return results
