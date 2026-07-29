import { useEffect, useRef, useState } from "react";
import { deleteDocument, listDocuments, renameDocument, uploadDocument } from "../api";
import DocumentViewer from "./DocumentViewer";
import { Rich, useLanguage } from "../i18n";

// There's no separate "name" field on the account (accounts/models.py —
// email is the only identity field), so the greeting derives one from the
// local part of the email: "jonathan.yuen66@gmail.com" -> "Jonathan".
function firstNameFromEmail(email) {
  const local = email.split("@")[0] || "";
  const firstSegment = local.split(/[._-]/)[0] || local;
  const letters = firstSegment.replace(/[^a-zA-Z]+$/, "") || firstSegment;
  return letters.charAt(0).toUpperCase() + letters.slice(1);
}

function statusPill(status, t) {
  switch (status) {
    case "ready":
      return { label: t("dashboard.statusReady"), className: "pill-ready" };
    case "processing":
      return { label: t("dashboard.statusProcessing"), className: "pill-processing" };
    case "failed":
      return { label: t("dashboard.statusFailed"), className: "pill-failed" };
    default:
      return { label: status, className: "pill-processing" };
  }
}

function greetingSubline(documents, t) {
  if (!documents || documents.length === 0) {
    return t("dashboard.greetingEmpty");
  }
  const ready = documents.filter((d) => d.status === "ready").length;
  const processing = documents.filter((d) => d.status === "processing").length;
  const failed = documents.filter((d) => d.status === "failed").length;

  const parts = [];
  if (ready > 0) parts.push(t("dashboard.reportsReady", { n: ready }));
  if (processing > 0) parts.push(t("dashboard.moreProcessing", { n: processing }));
  if (failed > 0) parts.push(t("dashboard.couldntProcessed", { n: failed }));
  return parts.length > 0 ? parts.join(" ") : t("dashboard.nothingNew");
}

export default function Dashboard({ user, onSignOut, onShowHowItWorks }) {
  const { t } = useLanguage();
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
    if (!window.confirm(t("dashboard.deleteConfirm"))) return;
    try {
      await deleteDocument(id);
      setDocuments((docs) => docs.filter((d) => d.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRename(doc) {
    setOpenMenuId(null);
    const next = window.prompt(t("dashboard.renamePrompt"), doc.display_name);
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
    return (
      <DocumentViewer
        document={viewing}
        onBack={() => setViewing(null)}
        onShowHowItWorks={onShowHowItWorks}
      />
    );
  }

  return (
    <main className="shell">
      <div className="top-row">
        <h1>PlainMed</h1>
        <p className="account">
          {t("dashboard.signedInAs", { email: user.email })}{" "}
          <button onClick={onSignOut}>{t("common.signOut")}</button>
        </p>
      </div>

      <div className="dash-greet">
        <h2 className="doc-title">
          {documents && documents.length > 0 ? t("dashboard.welcomeBack") : t("dashboard.welcome")}
          {firstNameFromEmail(user.email)}.
        </h2>
        <p className="dash-greet-sub">{greetingSubline(documents, t)}</p>
      </div>

      <p className="disclaimer" role="alert" aria-live="polite">
        {t("common.disclaimer")}
      </p>

      <div className="dash-grid">
        <aside className="dash-rail">
          <h2 className="doc-title dash-rail-title">{t("dashboard.addReportTitle")}</h2>
          <p className="dash-rail-lead">{t("dashboard.addReportLead")}</p>

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
              <p className="dash-drop-status">{t("dashboard.uploading")}</p>
            ) : (
              <>
                <p className="dash-drop-hint">{t("dashboard.dropHint")}</p>
                <label className="btn btn-primary" htmlFor="file-upload">
                  {t("dashboard.chooseFile")}
                </label>
              </>
            )}
          </div>

          {error && <p className="error-text" role="alert">{error}</p>}

          <div className="dash-faq">
            <h3>{t("dashboard.commonQuestions")}</h3>

            <div className="dash-qa">
              <p className="dash-q">{t("dashboard.q1")}</p>
              <p className="dash-a">
                <Rich text={t("dashboard.a1")} />
              </p>
            </div>

            <div className="dash-qa">
              <p className="dash-q">{t("dashboard.q2")}</p>
              <p className="dash-a">{t("dashboard.a2")}</p>
            </div>

            <div className="dash-qa">
              <p className="dash-q">{t("dashboard.q3")}</p>
              <p className="dash-a">{t("dashboard.a3")}</p>
            </div>

            <div className="dash-qa">
              <p className="dash-q">{t("dashboard.q4")}</p>
              <p className="dash-a">{t("dashboard.a4")}</p>
            </div>
          </div>

          <button className="btn-link dash-how-link" onClick={onShowHowItWorks}>
            {t("dashboard.howLink")}
          </button>
        </aside>

        <section className="dash-pane">
          <div className="dash-pane-head">
            <h2 className="doc-title">{t("dashboard.yourReports")}</h2>
            {documents && documents.length > 0 && (
              <span className="dash-pane-count">{t("dashboard.reportsCount", { n: documents.length })}</span>
            )}
          </div>

          {documents === undefined && <p className="loading-state">{t("dashboard.loadingDocuments")}</p>}
          {documents && documents.length === 0 && (
            <p className="empty-state">{t("dashboard.emptyState")}</p>
          )}
          {documents && documents.length > 0 && (
            <ul className="dash-doc-list">
              {documents.map((doc) => {
                const pill = statusPill(doc.status, t);
                return (
                  <li className="dash-doc" key={doc.id}>
                    <div className="dash-doc-main">
                      <p className="dash-doc-title">{doc.display_name}</p>
                      <p className="dash-doc-meta">
                        <span className={"pill " + pill.className}>{pill.label}</span>
                        {" "}
                        {t("dashboard.addedOn", { date: new Date(doc.created_at).toLocaleDateString() })}
                      </p>
                    </div>
                    <div className="dash-doc-acts">
                      {doc.status === "ready" && (
                        <button className="btn btn-primary" onClick={() => setViewing(doc)}>
                          {t("dashboard.readExplanation")}
                        </button>
                      )}
                      <div className="dash-more-wrap">
                        <button
                          className="dash-more"
                          aria-label={t("dashboard.moreActionsFor", { name: doc.display_name })}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={() => setOpenMenuId(openMenuId === doc.id ? null : doc.id)}
                        >
                          ⋯
                        </button>
                        {openMenuId === doc.id && (
                          <div className="dash-menu" onMouseDown={(e) => e.stopPropagation()}>
                            <button onClick={() => handleRename(doc)}>{t("dashboard.rename")}</button>
                            <button onClick={() => handleDelete(doc.id)}>{t("dashboard.delete")}</button>
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
