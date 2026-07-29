import { useEffect, useMemo, useState } from "react";
import { fetchAnnotations, fetchDocumentFile } from "../api";
import PdfDocument from "./PdfDocument";
import AskAboutTerm from "./AskAboutTerm";
import { useLanguage } from "../i18n";

export default function DocumentViewer({ document, onBack, onShowHowItWorks }) {
  const { language, t } = useLanguage();
  const [url, setUrl] = useState(null);
  const [fileError, setFileError] = useState("");
  const [annotations, setAnnotations] = useState(undefined); // undefined = loading
  const [annotationsError, setAnnotationsError] = useState("");
  const [hoveredTerm, setHoveredTerm] = useState(null);

  useEffect(() => {
    let objectUrl;
    let cancelled = false;

    fetchDocumentFile(document.id)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
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

  return (
    <main className="shell shell-viewer">
      <div className="viewer-head">
        <button className="btn-link" onClick={onBack}>
          {t("common.backToDocuments")}
        </button>
        <h1 className="doc-title">{document.display_name}</h1>
      </div>

      <p className="disclaimer" role="alert" aria-live="polite">
        {t("common.disclaimer")}
      </p>

      <div className="viewer-grid">
        <div className="annotations-pane">
          {annotations === undefined && !annotationsError && (
            <p className="loading-state">{t("documentViewer.generatingAnnotations")}</p>
          )}
          {annotationsError && <p className="error-text" role="alert">{annotationsError}</p>}
          {annotations && (
            <>
              <p className="summary-block">{annotations.summary}</p>
              <p className="viewer-hint">{t("documentViewer.theseAreTerms")}</p>
              <ol className="findings-list">
                {annotations.items.map((item) => (
                  <li
                    className={
                      "finding" + (hoveredTerm === item.term ? " finding-active" : "")
                    }
                    key={item.term}
                    onMouseEnter={() => setHoveredTerm(item.term)}
                    onMouseLeave={() => setHoveredTerm(null)}
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
              <p className="pane-actions">
                <a className="btn-link" href={url} target="_blank" rel="noopener noreferrer">
                  {t("common.openInNewTab")}
                </a>
              </p>
              <PdfDocument
                url={url}
                terms={terms}
                hoveredTerm={hoveredTerm}
                onHoverTerm={setHoveredTerm}
                documentId={document.id}
                language={language}
                onExplained={handleExplained}
              />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
