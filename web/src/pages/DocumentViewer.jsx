import { useEffect, useMemo, useRef, useState } from "react";
import { fetchAnnotations, fetchDocumentFile } from "../api";
import PdfDocument from "./PdfDocument";
import ImageDocument from "./ImageDocument";
import AskAboutTerm from "./AskAboutTerm";
import { useLanguage } from "../i18n";

export default function DocumentViewer({ document, onBack, onShowHowItWorks }) {
  const { language, t } = useLanguage();
  const [url, setUrl] = useState(null);
  // The served file's MIME type (from the blob's own .type, set server-side
  // from the original upload's extension) — decides whether the original
  // document renders through PdfDocument (pdf.js) or the much simpler
  // ImageDocument (a photo/scan upload has no PDF text layer to render).
  const [fileType, setFileType] = useState(null);
  const [fileError, setFileError] = useState("");
  const [annotations, setAnnotations] = useState(undefined); // undefined = loading
  const [annotationsError, setAnnotationsError] = useState("");
  const [hoveredTerm, setHoveredTerm] = useState(null);
  // A request to scroll the PDF pane to a given term — distinct from
  // hoveredTerm (which fires constantly on mouse movement and would make
  // the document lurch around on every hover) and carrying a nonce so
  // clicking the same finding twice in a row still re-scrolls, even though
  // the term string itself didn't change.
  const [scrollToTerm, setScrollToTerm] = useState(null); // { term, nonce } | null
  const scrollNonceRef = useRef(0);
  const findingsListRef = useRef(null);
  // Annotations are supplementary now — collapsible so the document can
  // take the full width when they're not needed.
  const [annotationsHidden, setAnnotationsHidden] = useState(false);

  useEffect(() => {
    let objectUrl;
    let cancelled = false;

    fetchDocumentFile(document.id)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setFileType(blob.type);
        setUrl(objectUrl);
      })
      .catch((err) => setFileError(err.message));

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [document.id]);

  useEffect(() => {
    let cancelled = false;
    setAnnotations(undefined);
    setAnnotationsError("");

    fetchAnnotations(document.id, language)
      .then((data) => {
        if (!cancelled) setAnnotations(data);
      })
      .catch((err) => {
        if (!cancelled) setAnnotationsError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [document.id, language]);

  // Memoized so hover-only re-renders (which don't touch `annotations`) don't
  // hand PdfDocument a new array reference and retrigger its whole render effect.
  const terms = useMemo(
    () => (annotations ? annotations.items.map((item) => item.term) : []),
    [annotations]
  );

  // The explain popover's result — merged in here (not just shown inline in
  // the popover) so a selected term joins the findings list and gets
  // highlighted like any other, from here on in this session.
  function handleExplained(item) {
    setAnnotations((current) => {
      if (!current) return current;
      const existingIndex = current.items.findIndex(
        (i) => i.term.toLowerCase() === item.term.toLowerCase()
      );
      const items =
        existingIndex === -1
          ? [...current.items, item]
          : current.items.map((i, idx) => (idx === existingIndex ? item : i));
      return { ...current, items };
    });
  }

  // Clicking a finding in the list scrolls the *document* pane to the
  // matching highlighted term (handled inside PdfDocument, which owns the
  // actual highlight spans) — the reverse of scrollToFinding below.
  function requestScrollToTerm(term) {
    scrollNonceRef.current += 1;
    setScrollToTerm({ term, nonce: scrollNonceRef.current });
  }

  // Clicking a highlighted term in the document scrolls the *findings
  // list* to the matching entry — passed down to PdfDocument as
  // onTermClick, since it's PdfDocument that owns the click listeners on
  // the actual highlight spans. Un-collapses the sidebar first if it's
  // hidden, since scrolling to an entry the user can't see would be silent
  // no-op otherwise.
  function scrollToFinding(term) {
    setAnnotationsHidden(false);
    requestAnimationFrame(() => {
      const el = findingsListRef.current?.querySelector(`[data-term="${CSS.escape(term)}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  return (
    <main className="shell shell-viewer">
      <div className="viewer-head">
        <button className="btn-link" onClick={onBack}>
          {t("common.backToDocuments")}
        </button>
        <h1 className="doc-title">{document.display_name}</h1>
      </div>

      {/* Static from mount, not a dynamic alert — role="alert" is for
          newly-appearing, time-sensitive content, and misapplying it here
          could make screen readers announce inconsistently rather than
          just read it in normal document order like any other text. */}
      <p className="disclaimer">{t("common.disclaimer")}</p>

      <div className={"viewer-grid" + (annotationsHidden ? " viewer-grid-collapsed" : "")}>
        <div className="document-pane">
          <span className="pane-label">{t("documentViewer.originalDocument")}</span>
          <p className="viewer-original-note">{t("documentViewer.originalNote")}</p>
          <details className="viewer-why-details">
            <summary>{t("documentViewer.whySummary")}</summary>
            <p>{t("documentViewer.whyBody")}</p>
            {onShowHowItWorks && (
              <p>
                <button className="btn-link" onClick={onShowHowItWorks}>
                  {t("documentViewer.whyLink")}
                </button>
              </p>
            )}
          </details>
          {fileError && <p className="error-text" role="alert">{fileError}</p>}
          {!url && !fileError && <p className="loading-state">{t("documentViewer.loadingDocument")}</p>}
          {url && (
            <>
              <div className="pane-actions">
                <a className="btn-link" href={url} target="_blank" rel="noopener noreferrer">
                  {t("common.openInNewTab")}
                </a>
                <button
                  type="button"
                  className="btn-link"
                  aria-expanded={!annotationsHidden}
                  aria-controls="annotations-panel"
                  onClick={() => setAnnotationsHidden((hidden) => !hidden)}
                >
                  {annotationsHidden
                    ? t("documentViewer.showAnnotations")
                    : t("documentViewer.hideAnnotations")}
                </button>
              </div>
              {fileType === "application/pdf" ? (
                <PdfDocument
                  url={url}
                  terms={terms}
                  hoveredTerm={hoveredTerm}
                  onHoverTerm={setHoveredTerm}
                  onTermClick={scrollToFinding}
                  scrollToTerm={scrollToTerm}
                  documentId={document.id}
                  language={language}
                  onExplained={handleExplained}
                />
              ) : (
                <ImageDocument url={url} />
              )}
            </>
          )}
        </div>

        <div className="annotations-pane" id="annotations-panel" hidden={annotationsHidden}>
          {/* Scoped to just the loading -> summary transition, not the
              findings list below — a screen reader user should hear "your
              annotations are ready" once, not have the whole list read at
              them automatically; the list itself is for deliberate
              navigation. */}
          <div aria-live="polite">
            {annotations === undefined && !annotationsError && (
              <p className="loading-state">{t("documentViewer.generatingAnnotations")}</p>
            )}
            {annotationsError && <p className="error-text" role="alert">{annotationsError}</p>}
            {annotations && <p className="summary-block">{annotations.summary}</p>}
          </div>
          {annotations && (
            <>
              <p className="viewer-hint">
                {fileType === "application/pdf"
                  ? t("documentViewer.theseAreTerms")
                  : t("documentViewer.theseAreTermsImage")}
              </p>
              <ol className="findings-list" ref={findingsListRef}>
                {annotations.items.map((item) => (
                  <li
                    className={
                      "finding" + (hoveredTerm === item.term ? " finding-active" : "")
                    }
                    key={item.term}
                    data-term={item.term}
                    onMouseEnter={() => setHoveredTerm(item.term)}
                    onMouseLeave={() => setHoveredTerm(null)}
                    onClick={() => requestScrollToTerm(item.term)}
                  >
                    <span className="finding-term">{item.term}</span>
                    <span className="finding-explain">{item.explanation}</span>
                    {item.source_found ? (
                      <ul className="citation-list">
                        {item.citations.map((c) => (
                          <li key={c.pmid}>
                            <a
                              className="citation"
                              href={c.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {c.title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="no-source">{t("common.noSourceFound")}</p>
                    )}
                  </li>
                ))}
              </ol>
              <AskAboutTerm documentId={document.id} language={language} onExplained={handleExplained} />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
