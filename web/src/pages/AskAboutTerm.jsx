import { useState } from "react";
import { explainTerm } from "../api";
import { useLanguage } from "../i18n";

const MAX_LENGTH = 300;

// The typed-input counterpart to ExplainPopover's select-in-the-PDF flow —
// same /explain/ endpoint, same PersonalInfoSelected safety net on the
// backend, same onExplained merge into the findings list above. Exists for
// a term that's easier to type or copy-paste than to select cleanly in the
// rendered PDF (or one that isn't in the document's own text at all).
export default function AskAboutTerm({ documentId, language, onExplained }) {
  const { t } = useLanguage();
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
      <p className="viewer-hint">{t("askAboutTerm.prompt")}</p>
      <form className="ask-about-term-form" onSubmit={handleSubmit}>
        <label htmlFor="ask-about-term-input" className="visually-hidden">
          {t("askAboutTerm.inputLabel")}
        </label>
        <input
          id="ask-about-term-input"
          type="text"
          placeholder={t("askAboutTerm.inputPlaceholder")}
          maxLength={MAX_LENGTH}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
        <button className="btn btn-primary" type="submit" disabled={status === "loading" || !term.trim()}>
          {status === "loading" ? t("common.explaining") : t("common.explain")}
        </button>
      </form>
      {error && <p className="error-text" role="alert">{error}</p>}
    </div>
  );
}
