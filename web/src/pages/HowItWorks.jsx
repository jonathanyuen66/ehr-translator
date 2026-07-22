// Fabricated for illustration only — not a real patient record. This exact
// pair of strings is the real, verified output of documents/deidentify.py
// run against the "before" text, not an approximation of what it does.
const SAMPLE_BEFORE = `Patient Name: Maria Garcia
Date of Birth: 08/22/1975
MRN: 4471002
Address: 142 Willow Lane, Springfield

CLINICAL HISTORY: Patient Maria Garcia presents with a persistent cough.

FINDINGS: A 2.1 cm nodule is noted in the right lower lobe, concerning for malignancy.`;

const SAMPLE_AFTER = `Patient Name: [REDACTED]
Date of Birth: [REDACTED]
MRN: [REDACTED]
Address: [REDACTED]

CLINICAL HISTORY: Patient [REDACTED] presents with a persistent cough.

FINDINGS: A 2.1 cm nodule is noted in the right lower lobe, concerning for malignancy.`;

// Each item the roadmap needs to say whether it's protecting uploads today
// or still being built — status is never implied by wording alone.
const ROADMAP = [
  {
    status: "live",
    title: "Redaction before the AI ever sees your document",
    detail:
      "Our own system finds and removes identifying details on every upload, automatically.",
  },
  {
    status: "live",
    title: "Google Cloud DLP as a second, independent detection layer",
    detail:
      "Google's own industry-standard scanner for identifiers, running alongside our system rather than instead of it.",
  },
  {
    status: "progress",
    title: "Encrypted storage with keys we control",
    detail: "Documents encrypted at rest using our own managed encryption keys, not just a provider default.",
  },
  {
    status: "progress",
    title: "A database with no public entry point",
    detail: "The database that stores your account and results is unreachable from the open internet, full stop.",
  },
  {
    status: "progress",
    title: "An enterprise AI backend instead of a consumer one",
    detail:
      "Moving off the consumer AI API to Google's enterprise offering, which doesn't train its models on your data and is eligible for a formal healthcare-data agreement.",
  },
  {
    status: "progress",
    title: "A full audit trail",
    detail: "A logged record of exactly when and how each document was accessed.",
  },
  {
    status: "progress",
    title: "A web application firewall",
    detail: "Automated blocking of common attack patterns before they ever reach the app.",
  },
  {
    status: "progress",
    title: "A signed Business Associate Agreement (BAA)",
    detail: "A formal legal agreement with our cloud provider — the last piece, and the one that makes all the rest count.",
  },
];

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

export default function HowItWorks({ onBack }) {
  return (
    <main className="shell">
      <button className="btn-link" onClick={onBack}>
        ← Back
      </button>
      <h1 className="doc-title">How this works, and why your document is safe</h1>
      <p className="disclaimer">
        This tool does not provide medical advice. It only helps explain the
        objective content of a document — always consult a qualified
        healthcare provider for interpretation and care decisions.
      </p>

      <section className="hiw-section">
        <h2>What happens to your document</h2>
        <ol className="hiw-steps">
          <li>You upload a scan report or doctor's note as a PDF.</li>
          <li>
            The text is pulled out of the PDF on our server, and identifying
            details — name, birthdate, ID numbers, address — are automatically
            found and removed. This happens immediately, before anything else.
          </li>
          <li>
            Only that stripped-down, de-identified text is shown to the AI. It
            never sees the original file, your name, or any other identifying
            detail.
          </li>
          <li>
            The AI picks out the key findings and looks them up against real
            published medical research — it's never allowed to cite a source
            that isn't from that real, retrieved list.
          </li>
          <li>
            You see a plain-language explanation of each finding, side by side
            with your original document, in your preferred language.
          </li>
        </ol>

        <div className="hiw-callout hiw-callout-note">
          <h3>An important distinction</h3>
          <p>
            The document viewer (step 5) always shows <strong>your original
            file, exactly as you uploaded it</strong> — it's your document,
            private to your account, so there's no reason to hide it from you.
            The redacted version is a separate copy that only ever exists for
            the AI to read. Nothing about what you see changes; what changes
            is what the AI is ever allowed to see.
          </p>
        </div>
      </section>

      <section className="hiw-section">
        <h2>This isn't the same as pasting your document into ChatGPT</h2>
        <p>
          Typing or uploading a document directly into a general-purpose AI
          chatbot sends it exactly as written — name, birthdate, medical
          record number, and all — straight to that company's servers, with
          nothing checking it on the way. This tool is built differently:
        </p>
        <div className="hiw-compare">
          <div className="hiw-compare-col hiw-compare-bad">
            <h3>A general AI chatbot</h3>
            <ul>
              <li>Sees your document exactly as written, identifying details included.</li>
              <li>Free/consumer tiers may reuse what you type to improve their models.</li>
              <li>No step exists to find or remove identifying details first.</li>
            </ul>
          </div>
          <div className="hiw-compare-col hiw-compare-good">
            <h3>This tool</h3>
            <ul>
              <li>Identifying details are removed before the AI ever sees the text.</li>
              <li>Two independent layers check for identifying details, so one method missing something is backed up by another.</li>
              <li>Your documents and results are private to your account.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="hiw-section">
        <h2>See it for yourself</h2>
        <p>
          Here's a fabricated example — not a real patient — showing exactly
          what the redaction step does before anything reaches the AI. Your
          own document viewer would still show the left-hand version; only
          the AI ever sees the right-hand one.
        </p>
        <div className="hiw-redact-demo">
          <div className="hiw-redact-col">
            <span className="pane-label">What you upload — and what you always see</span>
            <pre className="hiw-doc-sample">{SAMPLE_BEFORE}</pre>
          </div>
          <div className="hiw-redact-col">
            <span className="pane-label">What the AI actually sees</span>
            <pre className="hiw-doc-sample hiw-doc-redacted">{renderRedacted(SAMPLE_AFTER)}</pre>
          </div>
        </div>
        <p className="hiw-caption">
          Notice what's left behind: the actual medical finding ("2.1 cm
          nodule... concerning for malignancy") stays fully readable — only
          the details that identify <em>who</em> the document belongs to are
          removed.
        </p>
      </section>

      <section className="hiw-section">
        <h2>What "HIPAA compliant" actually means</h2>
        <p>
          HIPAA is the U.S. law governing how health information has to be
          protected. Being compliant with it isn't one setting to switch on —
          it's a bundle of separate safeguards that all have to be true at
          once:
        </p>
        <ol className="hiw-steps">
          <li>
            <strong>A signed agreement (a "BAA") with every vendor that
            touches health data</strong> — it makes them legally responsible
            for protecting it too, not just you.
          </li>
          <li>
            <strong>Encryption</strong> — scrambling data both while it's
            stored and while it's moving between systems, so it's unreadable
            if it's ever intercepted.
          </li>
          <li>
            <strong>Access controls</strong> — only specific, authorized
            systems and people can read the data, and only what they
            genuinely need to.
          </li>
          <li>
            <strong>Audit logging</strong> — a record of exactly who or what
            accessed a piece of data, and when.
          </li>
          <li>
            <strong>Breach notification</strong> — a legal duty to tell
            affected people if their data is ever exposed.
          </li>
        </ol>
      </section>

      <section className="hiw-section">
        <h2>Where this is headed</h2>
        <p>
          We're actively building out the full infrastructure above as part
          of a migration to Google Cloud. Some of it protects your documents
          today; the rest is real, in-progress work — not finished yet, and
          we'd rather say so plainly than imply otherwise.
        </p>
        <ul className="hiw-roadmap">
          {ROADMAP.map((item) => (
            <li className="hiw-roadmap-item" key={item.title}>
              <span className={"status-chip" + (item.status === "live" ? " status-chip-live" : "")}>
                {item.status === "live" ? "Active now" : "In progress"}
              </span>
              <span className="hiw-roadmap-text">
                <strong>{item.title}.</strong> {item.detail}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="hiw-section hiw-callout">
        <h2>Good to know</h2>
        <p>
          This app is invite-only, built for a small circle of family and
          friends — it isn't run as a certified hospital system yet, for
          exactly the reasons in the checklist above. The protections marked
          "Active now" are real and run on every upload today. If you're ever
          unsure, it's completely fine to black out or remove any detail
          yourself before uploading.
        </p>
      </section>

      <details className="hiw-details">
        <summary>Learn more: how the two layers of de-identification work</summary>
        <div className="hiw-details-body">
          <h3>
            Layer 1 — Google Cloud DLP{" "}
            <span className="status-chip status-chip-live">Active now</span>
          </h3>
          <p>
            Google's Data Loss Prevention service scans for standard
            identifiers — full names, phone numbers, email addresses, social
            security numbers, street addresses, dates — using detectors
            Google builds and maintains across a huge range of document
            types. It's a generalist: broad coverage of identifiers that show
            up in almost any kind of document, medical or not.
          </p>
          <h3>
            Layer 2 — Our own redaction system{" "}
            <span className="status-chip status-chip-live">Active now</span>
          </h3>
          <p>Three techniques, layered together:</p>
          <ul>
            <li>
              <strong>Labeled fields</strong> — anything following a header
              like "Patient Name:", "DOB:", "MRN:", or "Address:" is removed
              automatically.
            </li>
            <li>
              <strong>Narrative mentions</strong> — phrasing like "Patient
              Jane Doe presents with..." is recognized and redacted even
              outside a labeled field.
            </li>
            <li>
              <strong>Medical-text recognition</strong> — a model trained to
              recognize names, places, and dates within ordinary sentences
              catches what the first two techniques miss.
            </li>
          </ul>
          <p>
            <strong>Why two layers?</strong> No single method catches
            everything. A generalist identifier scanner (Layer 1) can miss a
            name embedded in unusual medical phrasing that Layer 2's
            medical-specific patterns are built to catch — and Layer 2, built
            for clinical documents specifically, doesn't know to look for
            things like credit card numbers the way a generalist scanner
            does. Running both means one layer's blind spot is usually the
            other's strength.
          </p>
        </div>
      </details>
    </main>
  );
}
