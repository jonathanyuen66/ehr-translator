import { useEffect, useRef, useState } from "react";
import { explainTerm } from "../api";

// Clamps the popover inside the viewport so a selection near an edge
// doesn't render partly off-screen.
const MARGIN = 12;
const POPOVER_WIDTH = 320;

function clampPosition(rect) {
  const top = Math.min(rect.bottom + 8, window.innerHeight - MARGIN);
  const left = Math.min(Math.max(rect.left, MARGIN), window.innerWidth - POPOVER_WIDTH - MARGIN);
  return { top, left };
}

// Anchored near a text selection in the PDF pane (PdfDocument.jsx passes
// `selection`). Starts as a single "Explain this" button so a selection
// doesn't immediately fire a Gemini call; only actually requests an
// explanation once clicked.
export default function ExplainPopover({ documentId, language, selection, onExplained, onDismiss }) {
  const [status, setStatus] = useState("idle"); // idle | loading | result | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const containerRef = useRef(null);

  // A fresh selection always starts a fresh popover, even if a previous
  // request is still in flight — the cancelled flag stops that stale
  // response from clobbering state for the new selection.
  useEffect(() => {
    setStatus("idle");
    setResult(null);
    setError("");
  }, [selection]);

  useEffect(() => {
    function handlePointerDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        onDismiss();
      }
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") onDismiss();
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleExplain() {
    setStatus("loading");
    setError("");
    try {
      const item = await explainTerm(documentId, selection.text, language);
      setResult(item);
      setStatus("result");
      onExplained(item);
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  }

  const { top, left } = clampPosition(selection.rect);

  return (
    <div
      ref={containerRef}
      className="explain-popover"
      style={{ top, left, width: POPOVER_WIDTH }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {status === "idle" && (
        <button className="btn btn-primary explain-popover-btn" onClick={handleExplain}>
          Explain "{selection.text.length > 40 ? `${selection.text.slice(0, 40)}…` : selection.text}"
        </button>
      )}
      {status === "loading" && <p className="loading-state explain-popover-loading">Explaining…</p>}
      {status === "error" && (
        <>
          <p className="error-text" role="alert">{error}</p>
          <button className="btn-link" onClick={handleExplain}>Try again</button>
        </>
      )}
      {status === "result" && result && (
        <div className="explain-popover-result">
          <span className="finding-term">{result.term}</span>
          <span className="finding-explain">{result.explanation}</span>
          {result.source_found ? (
            <ul className="citation-list">
              {result.citations.map((c) => (
                <li key={c.pmid}>
                  <a className="citation" href={c.url} target="_blank" rel="noopener noreferrer">
                    {c.title}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="no-source">No clear supporting source found.</p>
          )}
          <button className="btn-link explain-popover-close" onClick={onDismiss}>
            Got it
          </button>
        </div>
      )}
    </div>
  );
}
