import { useEffect, useMemo, useState } from "react";
import { fetchAnnotations, fetchDocumentFile } from "../api";
import PdfDocument from "./PdfDocument";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "zh-Hant", label: "繁體中文" },
];

export default function DocumentViewer({ document, onBack }) {
  const [url, setUrl] = useState(null);
  const [fileError, setFileError] = useState("");
  const [language, setLanguage] = useState("en");
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

  return (
    <main className="shell">
      <div className="viewer-head">
        <button className="btn-link" onClick={onBack}>
          ← Back to documents
        </button>
        <h1 className="doc-title">{document.original_filename}</h1>
        <div className="lang-switch">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              className={l.code === language ? "active" : ""}
              onClick={() => setLanguage(l.code)}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <p className="disclaimer" role="alert" aria-live="polite">
        This tool does not provide medical advice. It only helps explain the
        objective content of a document — always consult a qualified
        healthcare provider for interpretation and care decisions.
      </p>

      <div className="viewer-grid">
        <div className="annotations-pane">
          {annotations === undefined && !annotationsError && (
            <p className="loading-state">
              Generating annotations… this can take a little while the first time.
            </p>
          )}
          {annotationsError && <p className="error-text" role="alert">{annotationsError}</p>}
          {annotations && (
            <>
              <p className="summary-block">{annotations.summary}</p>
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
                      <p className="no-source">No clear supporting source found.</p>
                    )}
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>

        <div className="document-pane">
          <span className="pane-label">Original document</span>
          {fileError && <p className="error-text" role="alert">{fileError}</p>}
          {!url && !fileError && <p className="loading-state">Loading document…</p>}
          {url && (
            <>
              <p>
                <a className="btn-link" href={url} target="_blank" rel="noopener noreferrer">
                  Open in new tab
                </a>
              </p>
              <PdfDocument
                url={url}
                terms={terms}
                hoveredTerm={hoveredTerm}
                onHoverTerm={setHoveredTerm}
              />
            </>
          )}
        </div>
      </div>
    </main>
  );
}
