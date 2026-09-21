from unittest import mock

from django.test import SimpleTestCase

from . import pubmed, services

SAMPLE_EFETCH_XML = b"""<?xml version="1.0"?>
<PubmedArticleSet>
  <PubmedArticle>
    <MedlineCitation>
      <PMID>111</PMID>
      <Article>
        <Journal><JournalIssue><PubDate><Year>2022</Year></PubDate></JournalIssue></Journal>
        <ArticleTitle>Standardized uptake value in FDG PET: a review</ArticleTitle>
        <Abstract><AbstractText Label="BACKGROUND">SUV measures tracer uptake in tissue.</AbstractText>
          <AbstractText Label="CONCLUSION">SUVmax above 2.5 is often suspicious for malignancy.</AbstractText></Abstract>
        <PublicationTypeList>
          <PublicationType>Journal Article</PublicationType>
          <PublicationType>Review</PublicationType>
        </PublicationTypeList>
      </Article>
      <MeshHeadingList>
        <MeshHeading><DescriptorName>Humans</DescriptorName></MeshHeading>
        <MeshHeading><DescriptorName>Positron-Emission Tomography</DescriptorName></MeshHeading>
      </MeshHeadingList>
    </MedlineCitation>
  </PubmedArticle>
  <PubmedArticle>
    <MedlineCitation>
      <PMID>222</PMID>
      <Article>
        <Journal><JournalIssue><PubDate><MedlineDate>2009 Jan-Feb</MedlineDate></PubDate></JournalIssue></Journal>
        <ArticleTitle>Uptake of tracer in mouse xenografts</ArticleTitle>
        <Abstract><AbstractText>Mice were imaged.</AbstractText></Abstract>
        <PublicationTypeList><PublicationType>Journal Article</PublicationType></PublicationTypeList>
      </Article>
      <MeshHeadingList>
        <MeshHeading><DescriptorName>Animals</DescriptorName></MeshHeading>
        <MeshHeading><DescriptorName>Mice</DescriptorName></MeshHeading>
      </MeshHeadingList>
    </MedlineCitation>
  </PubmedArticle>
</PubmedArticleSet>"""


class BuildQueryTests(SimpleTestCase):
    spec = {
        "term": "SUVmax",
        "concept": "standardized uptake value",
        "synonyms": ["SUV"],
        "context": {"modality": "PET/CT", "body_region": "chest"},
    }

    def test_strict_tier_has_concept_context_and_human_filters(self):
        q = pubmed.build_query(self.spec, 0)
        self.assertIn('"standardized uptake value"[Title/Abstract]', q)
        self.assertIn('"SUV"[Title/Abstract]', q)
        self.assertIn('"PET/CT"[Title/Abstract]', q)
        self.assertIn("humans[MeSH Terms]", q)
        self.assertIn("hasabstract", q)

    def test_looser_tiers_drop_context_then_human_filter(self):
        self.assertNotIn("PET/CT", pubmed.build_query(self.spec, 1))
        self.assertIn("humans[MeSH Terms]", pubmed.build_query(self.spec, 1))
        last = pubmed.build_query(self.spec, 2)
        self.assertNotIn("humans[MeSH Terms]", last)
        self.assertIn("hasabstract", last)

    def test_model_text_cannot_inject_query_syntax(self):
        spec = {"term": 'x" OR "y', "concept": 'a") OR (b[MeSH Terms]', "synonyms": []}
        q = pubmed.build_query(spec, 1)
        self.assertNotIn('") OR (', q)
        self.assertEqual(q.count("[Title/Abstract]"), 1)

    def test_falls_back_to_term_when_no_concept(self):
        self.assertIn('"SUVmax"[Title/Abstract]', pubmed.build_query({"term": "SUVmax"}, 1))

    def test_empty_spec_gives_empty_query(self):
        self.assertEqual(pubmed.build_query({"term": ""}, 0), "")


class ParseAndRankTests(SimpleTestCase):
    def setUp(self):
        self.articles = pubmed.parse_articles(SAMPLE_EFETCH_XML)

    def test_parses_metadata(self):
        human = self.articles["111"]
        self.assertEqual(human["study_type"], "review")
        self.assertEqual(human["year"], 2022)
        self.assertTrue(human["is_human"])
        self.assertFalse(human["is_animal"])
        self.assertIn("SUVmax above 2.5", human["abstract"])

        animal = self.articles["222"]
        self.assertTrue(animal["is_animal"])
        self.assertFalse(animal["is_human"])
        self.assertEqual(animal["year"], 2009)
        self.assertIsNone(animal["study_type"])

    def test_human_review_outranks_animal_paper(self):
        spec = {"term": "uptake", "concept": "standardized uptake value", "synonyms": []}
        good = pubmed.score_candidate(self.articles["111"], spec)
        bad = pubmed.score_candidate(self.articles["222"], spec)
        self.assertGreater(good, bad)

    def test_commentary_is_penalized(self):
        spec = {"term": "x", "concept": "uptake"}
        plain = {"title": "uptake", "abstract": "", "pub_types": ["Journal Article"], "is_human": True}
        letter = {**plain, "pub_types": ["Letter"]}
        self.assertGreater(pubmed.score_candidate(plain, spec), pubmed.score_candidate(letter, spec))


class QuoteVerificationTests(SimpleTestCase):
    abstract = (
        "SUV measures tracer uptake in tissue. SUVmax above 2.5 is often "
        "suspicious for malignancy in solitary pulmonary nodules."
    )
    candidate = {
        "pmid": "111",
        "title": "SUV review",
        "url": "https://pubmed.ncbi.nlm.nih.gov/111/",
        "abstract": abstract,
        "study_type": "review",
        "year": 2022,
    }

    def verify(self, citations, candidates=None):
        return services._verify_citations(citations, candidates or [self.candidate], "SUVmax")

    def test_verbatim_quote_passes_and_carries_pubmed_metadata(self):
        out = self.verify([{"pmid": "111", "evidence_quote": "SUVmax above 2.5 is often suspicious for malignancy"}])
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]["study_type"], "review")
        self.assertEqual(out[0]["year"], 2022)
        self.assertEqual(out[0]["title"], "SUV review")

    def test_punctuation_and_case_differences_still_verbatim(self):
        out = self.verify([{"pmid": "111", "evidence_quote": "suvmax ABOVE 2.5, is often suspicious for malignancy!"}])
        self.assertEqual(len(out), 1)

    def test_paraphrase_is_rejected(self):
        out = self.verify([{"pmid": "111", "evidence_quote": "A high SUV usually means cancer is likely present"}])
        self.assertEqual(out, [])

    def test_unknown_pmid_is_rejected(self):
        out = self.verify([{"pmid": "999", "evidence_quote": "SUVmax above 2.5 is often suspicious"}])
        self.assertEqual(out, [])

    def test_too_short_quote_is_rejected(self):
        self.assertEqual(self.verify([{"pmid": "111", "evidence_quote": "SUV measures"}]), [])

    def test_missing_quote_is_rejected(self):
        self.assertEqual(self.verify([{"pmid": "111"}]), [])

    def test_ellipsis_joined_fragments_each_checked(self):
        ok = "SUV measures tracer uptake in tissue ... suspicious for malignancy in solitary pulmonary nodules"
        self.assertEqual(len(self.verify([{"pmid": "111", "evidence_quote": ok}])), 1)
        bad = "SUV measures tracer uptake in tissue ... this half was invented by the model entirely"
        self.assertEqual(self.verify([{"pmid": "111", "evidence_quote": bad}]), [])

    def test_duplicate_pmid_counted_once(self):
        q = "SUVmax above 2.5 is often suspicious for malignancy"
        out = self.verify([{"pmid": "111", "evidence_quote": q}, {"pmid": "111", "evidence_quote": q}])
        self.assertEqual(len(out), 1)


class CandidateMatchingTests(SimpleTestCase):
    findings = [
        {"term": "SUVmax", "candidates": ["a"]},
        {"term": "Hypermetabolic", "candidates": ["b"]},
    ]

    def test_matches_despite_case_and_punctuation(self):
        self.assertEqual(services._candidates_for_item("hypermetabolic.", 0, 2, self.findings), ["b"])

    def test_falls_back_to_position_when_counts_match(self):
        self.assertEqual(services._candidates_for_item("reworded term", 1, 2, self.findings), ["b"])

    def test_no_positional_guess_when_counts_differ(self):
        self.assertEqual(services._candidates_for_item("reworded term", 1, 3, self.findings), [])


class SelectCandidatesTests(SimpleTestCase):
    def pool(self):
        return [
            {"pmid": "1", "title": "t1", "abstract": "a"},
            {"pmid": "2", "title": "t2", "abstract": "b"},
            {"pmid": "3", "title": "t3", "abstract": "c"},
        ]

    def test_keeps_only_relevant_human_papers(self):
        spec = {"term": "uptake", "concept": "FDG uptake"}
        grades = [[
            {"pmid": "1", "relevance": "yes", "human_subjects": True},
            {"pmid": "2", "relevance": "yes", "human_subjects": False},
            {"pmid": "3", "relevance": "tangential", "human_subjects": True},
        ]]
        with mock.patch.object(services.gemini, "grade_candidates", return_value=grades):
            out = services._select_candidates([spec], [self.pool()])
        self.assertEqual([c["pmid"] for c in out[0]], ["1"])

    def test_ungraded_candidates_are_dropped(self):
        spec = {"term": "uptake", "concept": "FDG uptake"}
        with mock.patch.object(services.gemini, "grade_candidates", return_value=[[]]):
            self.assertEqual(services._select_candidates([spec], [self.pool()]), [[]])

    def test_grader_failure_degrades_to_rerank_order(self):
        spec = {"term": "uptake", "concept": "FDG uptake"}
        with mock.patch.object(services.gemini, "grade_candidates", side_effect=RuntimeError("boom")):
            out = services._select_candidates([spec], [self.pool()])
        self.assertEqual([c["pmid"] for c in out[0]], ["1", "2", "3"])


class SearchTierTests(SimpleTestCase):
    """Which tiers get tried, and that reviews are unioned in."""

    def run_search(self, spec, results_by_call):
        calls = []

        def fake_esearch(query, retmax):
            calls.append(query)
            return results_by_call[min(len(calls), len(results_by_call)) - 1]

        with mock.patch.object(pubmed, "_esearch", side_effect=fake_esearch):
            pmids = pubmed._search_pmids(spec)
        return pmids, calls

    def test_specific_term_never_uses_scan_context(self):
        spec = {"term": "hyponatremia", "concept": "hyponatremia", "needs_context": False,
                "context": {"modality": "metabolic panel", "body_region": ""}}
        _, calls = self.run_search(spec, [["1", "2", "3", "4"]])
        self.assertTrue(all("metabolic panel" not in q for q in calls))

    def test_ambiguous_term_starts_with_context(self):
        spec = {"term": "uptake", "concept": "FDG uptake", "needs_context": True,
                "context": {"modality": "PET/CT", "body_region": "chest"}}
        _, calls = self.run_search(spec, [["1", "2", "3"]])
        self.assertIn("PET/CT", calls[0])

    def test_narrow_tier_falls_back_to_looser_one(self):
        spec = {"term": "uptake", "concept": "FDG uptake", "needs_context": True,
                "context": {"modality": "PET/CT", "body_region": "chest"}}
        _, calls = self.run_search(spec, [["1"], ["1", "2", "3"]])
        self.assertIn("PET/CT", calls[0])
        self.assertNotIn("PET/CT", calls[1])

    def test_review_variant_is_unioned_without_duplicates(self):
        spec = {"term": "x", "concept": "leukocytosis", "needs_context": False}
        pmids, calls = self.run_search(spec, [["1", "2", "3"], ["3", "9"]])
        self.assertEqual(pmids, ["1", "2", "3", "9"])
        self.assertIn("Publication Type", calls[-1])

    def test_no_results_means_no_review_query(self):
        spec = {"term": "x", "concept": "nothing", "needs_context": False}
        pmids, calls = self.run_search(spec, [[]])
        self.assertEqual(pmids, [])
        self.assertTrue(all("Publication Type" not in q for q in calls))
