import { useEffect, useRef, useState } from "react";
import { deleteDocument, listDocuments, renameDocument, uploadDocument } from "../api";
import DocumentViewer from "./DocumentViewer";

// There's no separate "name" field on the account (accounts/models.py —
// email is the only identity field), so the greeting derives one from the
// local part of the email: "jonathan.yuen66@gmail.com" -> "Jonathan".
function firstNameFromEmail(email) {
  const local = email.split("@")[0] || "";
  const firstSegment = local.split(/[._-]/)[0] || local;
  const letters = firstSegment.replace(/[^a-zA-Z]+$/, "") || firstSegment;
  return letters.charAt(0).toUpperCase() + letters.slice(1);
}

const STATUS_PILLS = {
  ready: { label: "Explanation ready", className: "pill-ready" },
  processing: { label: "Still processing", className: "pill-processing" },
  failed: { label: "Couldn't be processed", className: "pill-failed" },
};

function greetingSubline(documents) {
  if (!documents || documents.length === 0) {
    return "Add your first report below to see how it works.";
  }
  const ready = documents.filter((d) => d.status === "ready").length;
  const processing = documents.filter((d) => d.status === "processing").length;
  const failed = documents.filter((d) => d.status === "failed").length;

  const parts = [];
  if (ready > 0) {
    parts.push(`${ready} report${ready === 1 ? " is" : "s are"} ready to read.`);
  }
  if (processing > 0) {
    parts.push(
      `${processing === 1 ? "Another" : `${processing} more`} still being explained — you don't need to wait around for ${processing === 1 ? "it" : "them"}.`
    );
  }
  if (failed > 0) {
    parts.push(`${failed} couldn't be processed — you can remove ${failed === 1 ? "it" : "them"} and try again.`);
  }
  return parts.length > 0 ? parts.join(" ") : "Nothing new since you were last here.";
}

export default function Dashboard({ user, onSignOut, onShowHowItWorks }) {
  const [documents, setDocuments] = useState(undefined); // undefined = loading
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    refresh();
  }, []);

  function refresh() {
    listDocuments()
      .then(setDocuments)
      .catch((err) => setError(err.message));
  }

  // Single-step upload — no separate "confirm" click, whether the file came
  // from the picker or a drop. The display name isn't collected up front
  // (the API already falls back to the original filename); rename after the
  // fact via the "⋯" menu covers the same need without an extra field.
  async function uploadFile(file) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const doc = await uploadDocument(file, "");
      setDocuments((docs) => [doc, ...(docs || [])]);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleFileChange(e) {
    uploadFile(e.target.files?.[0]);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    uploadFile(e.dataTransfer.files?.[0]);
  }

  async function handleDelete(id) {
    setOpenMenuId(null);
    if (!window.confirm("Delete this document? This can't be undone.")) return;
    try {
      await deleteDocument(id);
      setDocuments((docs) => docs.filter((d) => d.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRename(doc) {
    setOpenMenuId(null);
    const next = window.prompt("Rename document:", doc.display_name);
    if (next === null) return; // cancelled
    const trimmed = next.trim();
    if (!trimmed || trimmed === doc.display_name) return;

    try {
      const updated = await renameDocument(doc.id, trimmed);
      setDocuments((docs) => docs.map((d) => (d.id === doc.id ? updated : d)));
    } catch (err) {
      setError(err.message);
    }
  }

  // Closes an open "⋯" menu on an outside click or Escape — the menu itself
  // stops propagation (see onMouseDown below) so opening one doesn't
  // immediately close itself via this same listener.
  useEffect(() => {
    if (openMenuId === null) return;
    function handlePointerDown() {
      setOpenMenuId(null);
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") setOpenMenuId(null);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenuId]);

  if (viewing) {
    return <DocumentViewer document={viewing} onBack={() => setViewing(null)} />;
  }

  return (
    <main className="shell">
      <div className="top-row">
        <h1>PlainMed</h1>
        <p className="account">
          Signed in as {user.email} <button onClick={onSignOut}>Sign out</button>
        </p>
      </div>

      <div className="dash-greet">
        <h2 className="doc-title">
          {documents && documents.length > 0 ? "Welcome back, " : "Welcome, "}
          {firstNameFromEmail(user.email)}.
        </h2>
        <p className="dash-greet-sub">{greetingSubline(documents)}</p>
      </div>

      <p className="disclaimer" role="alert" aria-live="polite">
        This tool does not provide medical advice. It only helps explain the
        objective content of a document — always consult a qualified
        healthcare provider for interpretation and care decisions.
      </p>

      <div className="dash-grid">
        <aside className="dash-rail">
          <h2 className="doc-title dash-rail-title">Add a report</h2>
          <p className="dash-rail-lead">A lab result, scan report, or doctor's note — as a PDF.</p>

          <div
            className={"dash-drop" + (dragOver ? " dash-drop-over" : "")}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragOver(false);
            }}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              id="file-upload"
              className="visually-hidden"
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              disabled={uploading}
            />
            {uploading ? (
              <p className="dash-drop-status">Uploading…</p>
            ) : (
              <>
                <p className="dash-drop-hint">Drop a PDF here, or</p>
                <label className="btn btn-primary" htmlFor="file-upload">
                  Choose a file
                </label>
              </>
            )}
          </div>

          {error && <p className="error-text" role="alert">{error}</p>}

          <div className="dash-faq">
            <h3>Common questions</h3>

            <div className="dash-qa">
              <p className="dash-q">Where do I get the PDF?</p>
              <p className="dash-a">
                In MyChart or LiveWell, open the result and choose <code>Download</code>, or the
                printer icon, and save it as a PDF. On a phone, tap Share, then Save to Files.
              </p>
            </div>

            <div className="dash-qa">
              <p className="dash-q">Who can see what I add?</p>
              <p className="dash-a">
                Only you. Your name, birthday, and record number are removed before anything is
                sent to be explained.
              </p>
            </div>

            <div className="dash-qa">
              <p className="dash-q">How long does it take?</p>
              <p className="dash-a">About a minute. You can close the page and come back later.</p>
            </div>

            <div className="dash-qa">
              <p className="dash-q">Will it tell me if something is wrong?</p>
              <p className="dash-a">
                No. It explains what the words mean. What your results mean for you is a
                conversation with your doctor.
              </p>
            </div>
          </div>

          <button className="btn-link dash-how-link" onClick={onShowHowItWorks}>
            How this works, and how your document is kept private →
          </button>
        </aside>

        <section className="dash-pane">
          <div className="dash-pane-head">
            <h2 className="doc-title">Your reports</h2>
            {documents && documents.length > 0 && (
              <span className="dash-pane-count">
                {documents.length} report{documents.length === 1 ? "" : "s"} · newest first
              </span>
            )}
          </div>

          {documents === undefined && <p className="loading-state">Loading documents…</p>}
          {documents && documents.length === 0 && (
            <p className="empty-state">No reports yet — add your first one to see how it works.</p>
          )}
          {documents && documents.length > 0 && (
            <ul className="dash-doc-list">
              {documents.map((doc) => {
                const pill = STATUS_PILLS[doc.status] ?? { label: doc.status, className: "pill-processing" };
                return (
                  <li className="dash-doc" key={doc.id}>
                    <div className="dash-doc-main">
                      <p className="dash-doc-title">{doc.display_name}</p>
                      <p className="dash-doc-meta">
                        <span className={"pill " + pill.className}>{pill.label}</span>
                        {" "}Added {new Date(doc.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="dash-doc-acts">
                      {doc.status === "ready" && (
                        <button className="btn btn-primary" onClick={() => setViewing(doc)}>
                          Read the explanation
                        </button>
                      )}
                      <div className="dash-more-wrap">
                        <button
                          className="dash-more"
                          aria-label={`More actions for ${doc.display_name}`}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={() => setOpenMenuId(openMenuId === doc.id ? null : doc.id)}
                        >
                          ⋯
                        </button>
                        {openMenuId === doc.id && (
                          <div className="dash-menu" onMouseDown={(e) => e.stopPropagation()}>
                            <button onClick={() => handleRename(doc)}>Rename</button>
                            <button onClick={() => handleDelete(doc.id)}>Delete</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
