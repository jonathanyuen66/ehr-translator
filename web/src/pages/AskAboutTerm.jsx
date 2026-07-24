import { useState } from "react";
import { explainTerm } from "../api";

const MAX_LENGTH = 300;

// The typed-input counterpart to ExplainPopover's select-in-the-PDF flow —
// same /explain/ endpoint, same PersonalInfoSelected safety net on the
// backend, same onExplained merge into the findings list above. Exists for
// a term that's easier to type or copy-paste than to select cleanly in the
// rendered PDF (or one that isn't in the document's own text at all).
export default function AskAboutTerm({ documentId, language, onExplained }) {
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | error
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = term.trim();
    if (!trimmed) return;

    setStatus("loading");
    setError("");
    try {
      const item = await explainTerm(documentId, trimmed, language);
      onExplained(item);
      setTerm("");
      setStatus("idle");
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  }

  return (
    <div className="ask-about-term">
      <p className="viewer-hint">Still have a question about a specific word or phrase?</p>
      <form className="ask-about-term-form" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Type or paste a term from the document"
          maxLength={MAX_LENGTH}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
        <button className="btn btn-primary" type="submit" disabled={status === "loading" || !term.trim()}>
          {status === "loading" ? "Explaining…" : "Explain"}
        </button>
      </form>
      {error && <p className="error-text" role="alert">{error}</p>}
    </div>
  );
}
