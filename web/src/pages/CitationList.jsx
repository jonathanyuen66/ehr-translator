import { useLanguage } from "../i18n";

// Shared by the findings list and the explain popover. A citation reaching
// here has already been verified server-side (real paper, and a quoted
// excerpt that really appears in its abstract), so the tag and excerpt below
// are shown as-is — but every extra field is optional, since annotations
// cached before verification existed only carry {pmid, title, url}.
export default function CitationList({ citations }) {
  const { t } = useLanguage();

  return (
    <ul className="citation-list">
      {citations.map((c) => {
        const studyType = c.study_type ? t(`citation.studyTypes.${c.study_type}`) : null;
        const meta = [studyType, c.year].filter(Boolean).join(" · ");
        return (
          <li key={c.pmid}>
            <a className="citation" href={c.url} target="_blank" rel="noopener noreferrer">
              {c.title}
            </a>
            {meta && <span className="citation-meta">{meta}</span>}
            {c.evidence_quote && (
              <p className="citation-evidence">
                <span className="citation-evidence-label">{t("citation.whyThisSource")}</span>{" "}
                {/* The excerpt is the paper's own English text, whatever language the
                    page is in — marked so a screen reader pronounces it as English. */}
                <q lang="en">{c.evidence_quote}</q>
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
