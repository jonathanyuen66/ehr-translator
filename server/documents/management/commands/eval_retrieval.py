from django.core.management.base import BaseCommand

from documents import pubmed
from documents.services import _select_candidates

# Term/concept/context triples shaped like what identify_findings produces for
# real reports. Deliberately includes generic and ambiguous terms ("uptake",
# "SUV", "lesions"), which is where naive retrieval goes wrong.
GOLDEN_SET = [
    # (term, concept, synonyms, needs_context, context) — concepts written the
    # way identify_findings is instructed to: expanded, faithful to the text,
    # no added diagnosis.
    ("SUVmax", "standardized uptake value", ["SUV"], True, {"modality": "PET/CT", "body_region": "chest"}),
    ("uptake", "FDG uptake", [], True, {"modality": "PET/CT", "body_region": "chest"}),
    ("hypermetabolic", "FDG hypermetabolism", ["increased FDG avidity"], True, {"modality": "PET/CT", "body_region": "chest"}),
    ("right paratracheal lymph node", "paratracheal lymph node", ["mediastinal lymph node"], False, {"modality": "PET/CT", "body_region": "chest"}),
    ("osteosclerotic lesions", "osteosclerotic bone lesions", [], False, {"modality": "PET/CT", "body_region": "skeleton"}),
    ("hyponatremia", "hyponatremia", ["low serum sodium"], False, {"modality": "metabolic panel", "body_region": ""}),
    ("leukocytosis", "leukocytosis", ["elevated white blood cell count"], False, {"modality": "complete blood count", "body_region": ""}),
]


def _label(c):
    bits = [c.get("study_type") or "study", str(c.get("year") or "?"), "human" if c.get("is_human") else ("ANIMAL" if c.get("is_animal") else "?")]
    return f"[{', '.join(bits)}] {c['title'][:110]}"


class Command(BaseCommand):
    help = (
        "Prints, for a golden set of report terms, what a bare-keyword PubMed search returns next to what the "
        "context-aware retrieval returns — a review aid, there are no ground-truth labels. Add --grade to also run "
        "the (real Gemini) relevance gate."
    )

    def add_arguments(self, parser):
        parser.add_argument("--grade", action="store_true", help="also run the LLM relevance gate on the new pool")

    def handle(self, *args, **options):
        specs = [
            {"term": t, "concept": c, "synonyms": s, "needs_context": nc, "context": ctx}
            for t, c, s, nc, ctx in GOLDEN_SET
        ]
        pools = pubmed.search_many(specs)
        selected = None
        if options["grade"]:
            selected = _select_candidates(specs, pools)

        for i, spec in enumerate(specs):
            self.stdout.write(self.style.MIGRATE_HEADING(f"\n{spec['term']}  (concept: {spec['concept']})"))

            self.stdout.write("  BEFORE - bare term, PubMed relevance order, top 3:")
            naive_ids = pubmed._esearch(f'"{spec["term"]}"', 3)
            naive = pubmed._fetch_details(naive_ids)
            for pmid in naive_ids:
                if pmid in naive:
                    self.stdout.write(f"    {_label(naive[pmid])}")

            self.stdout.write("  AFTER - context-aware query + rerank, top 6 candidates:")
            for c in pools[i]:
                self.stdout.write(f"    {_label(c)}")
            if selected is not None:
                self.stdout.write("  AFTER - kept by relevance gate (max 3):")
                for c in selected[i] or []:
                    self.stdout.write(self.style.SUCCESS(f"    {_label(c)}"))
                if not selected[i]:
                    self.stdout.write("    (none - would be explained uncited)")
