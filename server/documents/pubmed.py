import logging
import time
import xml.etree.ElementTree as ET

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

ESEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
EFETCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"

_RETRY_DELAYS = (1, 2, 4)  # seconds; NCBI's without-a-key limit is 3 req/sec


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


def search(query: str, max_results: int = 3) -> list[dict]:
    """Search PubMed and return real, existing papers.

    This is the only source material the annotation model is later allowed
    to cite — it never gets to invent a PMID that didn't come from here.
    """
    params = {
        "db": "pubmed",
        "term": query,
        "retmax": max_results,
        "sort": "relevance",
        "retmode": "json",
        "tool": "ehr-translator",
    }
    if settings.PUBMED_API_KEY:
        params["api_key"] = settings.PUBMED_API_KEY

    resp = _get_with_retry(ESEARCH_URL, params)
    pmids = resp.json().get("esearchresult", {}).get("idlist", [])
    if not pmids:
        return []
    return _fetch_details(pmids)


def _fetch_details(pmids: list[str]) -> list[dict]:
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
    root = ET.fromstring(resp.content)

    results = []
    for article in root.findall(".//PubmedArticle"):
        pmid_el = article.find(".//PMID")
        if pmid_el is None or not pmid_el.text:
            continue
        pmid = pmid_el.text

        title_el = article.find(".//ArticleTitle")
        title = "".join(title_el.itertext()).strip() if title_el is not None else ""

        abstract_parts = article.findall(".//AbstractText")
        abstract = " ".join("".join(p.itertext()).strip() for p in abstract_parts)

        results.append(
            {
                "pmid": pmid,
                "title": title,
                "abstract": abstract[:1000],  # keep the prompt payload bounded
                "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
            }
        )
    return results
