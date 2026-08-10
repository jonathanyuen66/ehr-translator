import { Rich, useLanguage } from "../i18n";

// Fabricated for illustration only — not a real patient record. This exact
// pair of strings is the real, verified output of documents/deidentify.py
// run against the "before" text, not an approximation of what it does. Kept
// in English regardless of site language — like DemoPreview's sample
// document, this represents what a real doctor's note looks like, and a
// real note stays in whatever language it was originally written in.
const SAMPLE_BEFORE = `Patient Name: Jane Doe
Date of Birth: 01/01/1900
MRN: 4471002
Address: 123 Main Street, Springfield, IL 62701

CLINICAL HISTORY: Patient Jane Doe presents with a persistent cough.

FINDINGS: A 2.1 cm nodule is noted in the right lower lobe, concerning for malignancy.`;

const SAMPLE_AFTER = `Patient Name: [REDACTED]
Date of Birth: [REDACTED]
MRN: [REDACTED]
Address: [REDACTED]

CLINICAL HISTORY: Patient [REDACTED] presents with a persistent cough.

FINDINGS: A 2.1 cm nodule is noted in the right lower lobe, concerning for malignancy.`;

// Splits on "[REDACTED]" and wraps each occurrence in a styled span, so the
// redacted sample visually pops instead of just reading as plain text.
function renderRedacted(text) {
  return text.split(/(\[REDACTED\])/g).map((chunk, i) =>
    chunk === "[REDACTED]" ? (
      <mark className="redacted-token" key={i}>
        {chunk}
      </mark>
    ) : (
      <span key={i}>{chunk}</span>
    )
  );
}

// The actual "how this works" content, split out from the standalone page
// below so the sign-in page can render it inline (filling the page as the
// signed-out home page) without also inheriting the "← Back" navigation
// that only makes sense when this is reached as its own separate screen
// (Dashboard's own "How this works" link, still a click-through there).
export function HowItWorksContent({ headingLevel = "h1" }) {
  const { t } = useLanguage();
  const roadmap = t("howItWorks.roadmap.items");
  // The sign-in page already has its own <h1> ("PlainMed") and embeds this
  // content inline below it — a second <h1> there would give screen reader
  // users navigating by heading two competing "top level" headings on what's
  // supposed to be one page. The standalone /how-it-works route (below)
  // doesn't have that conflict, so it keeps the default h1.
  const TitleTag = headingLevel;

  return (
    <>
      <TitleTag className="doc-title">{t("howItWorks.pageTitle")}</TitleTag>
      <p className="disclaimer">{t("common.disclaimer")}</p>

      <section className="hiw-section" id="pipeline">
        <h2>{t("howItWorks.pipeline.heading")}</h2>
        <ol className="hiw-steps">
          {t("howItWorks.pipeline.steps").map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>

        <div className="hiw-callout hiw-callout-note">
          <h3>{t("howItWorks.pipeline.calloutTitle")}</h3>
          <p>
            <Rich text={t("howItWorks.pipeline.calloutBody")} />
          </p>
        </div>
      </section>

      <section className="hiw-section">
        <h2>{t("howItWorks.doesDoesnt.heading")}</h2>
        <p>{t("howItWorks.doesDoesnt.intro")}</p>
        <div className="hiw-compare">
          <div className="hiw-compare-col hiw-compare-good">
            <h3>{t("howItWorks.doesDoesnt.doesTitle")}</h3>
            <ul>
              {t("howItWorks.doesDoesnt.doesItems").map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="hiw-compare-col hiw-compare-bad">
            <h3>{t("howItWorks.doesDoesnt.doesntTitle")}</h3>
            <ul>
              {t("howItWorks.doesDoesnt.doesntItems").map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="hiw-section">
        <h2>{t("howItWorks.demo.heading")}</h2>
        <p>{t("howItWorks.demo.intro")}</p>
        <div className="hiw-redact-demo">
          <div className="hiw-redact-col">
            <span className="pane-label">{t("howItWorks.demo.beforeLabel")}</span>
            <pre className="hiw-doc-sample">{SAMPLE_BEFORE}</pre>
          </div>
          <div className="hiw-redact-col">
            <span className="pane-label">{t("howItWorks.demo.afterLabel")}</span>
            <pre className="hiw-doc-sample hiw-doc-redacted">{renderRedacted(SAMPLE_AFTER)}</pre>
          </div>
        </div>
        <p className="hiw-caption">
          <Rich text={t("howItWorks.demo.caption")} />
        </p>
      </section>

      <section className="hiw-section">
        <h2>{t("howItWorks.access.heading")}</h2>
        <p>{t("howItWorks.access.intro")}</p>
        <div className="hiw-facts">
          <div>
            <h3>{t("howItWorks.access.inviteOnlyTitle")}</h3>
            <p>{t("howItWorks.access.inviteOnlyBody")}</p>
          </div>
          <div>
            <h3>{t("howItWorks.access.noPasswordsTitle")}</h3>
            <p>{t("howItWorks.access.noPasswordsBody")}</p>
          </div>
          <div>
            <h3>{t("howItWorks.access.yoursTitle")}</h3>
            <p>{t("howItWorks.access.yoursBody")}</p>
          </div>
        </div>
      </section>

      <section className="hiw-section">
        <h2>{t("howItWorks.hipaa.heading")}</h2>
        <p>{t("howItWorks.hipaa.intro")}</p>
        <ol className="hiw-steps">
          {t("howItWorks.hipaa.items").map((item, i) => (
            <li key={i}>
              <strong>{item.strong}</strong> {item.rest}
            </li>
          ))}
        </ol>
      </section>

      <section className="hiw-section">
        <h2>{t("howItWorks.roadmap.heading")}</h2>
        <p>{t("howItWorks.roadmap.intro")}</p>
        <ul className="hiw-roadmap">
          {roadmap.map((item) => (
            <li className="hiw-roadmap-item" key={item.title}>
              <span className={"status-chip" + (item.status === "live" ? " status-chip-live" : "")}>
                {item.status === "live" ? t("howItWorks.roadmap.activeNow") : t("howItWorks.roadmap.inProgress")}
              </span>
              <span className="hiw-roadmap-text">
                <strong>{item.title}.</strong> {item.detail}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="hiw-section hiw-callout">
        <h2>{t("howItWorks.goodToKnow.heading")}</h2>
        <p>
          <Rich text={t("howItWorks.goodToKnow.body")} />
        </p>
      </section>

      <details className="hiw-details">
        <summary>{t("howItWorks.detailsSummary")}</summary>
        <div className="hiw-details-body">
          <h3>
            {t("howItWorks.details.layer1Title")}{" "}
            <span className="status-chip status-chip-live">{t("howItWorks.roadmap.activeNow")}</span>
          </h3>
          <p>{t("howItWorks.details.layer1Body")}</p>
          <h3>
            {t("howItWorks.details.layer2Title")}{" "}
            <span className="status-chip status-chip-live">{t("howItWorks.roadmap.activeNow")}</span>
          </h3>
          <p>{t("howItWorks.details.layer2Intro")}</p>
          <ul>
            {t("howItWorks.details.layer2Items").map((item, i) => (
              <li key={i}>
                <strong>{item.strong}</strong> {item.rest}
              </li>
            ))}
          </ul>
          <p>
            <Rich text={t("howItWorks.details.whyTwoLayers")} />
          </p>
        </div>
      </details>
    </>
  );
}

export default function HowItWorks({ onBack }) {
  const { t } = useLanguage();
  return (
    <main className="shell">
      <button className="btn-link" onClick={onBack}>
        {t("common.back")}
      </button>
      <HowItWorksContent />
    </main>
  );
}
