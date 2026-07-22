import { useEffect, useRef, useState } from "react";
import { deleteDocument, listDocuments, renameDocument, uploadDocument } from "../api";
import DocumentViewer from "./DocumentViewer";

function stripExtension(filename) {
  return filename.replace(/\.pdf$/i, "");
}

export default function Dashboard({ user, onSignOut, onShowHowItWorks }) {
  const [documents, setDocuments] = useState(undefined); // undefined = loading
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    refresh();
  }, []);

  function refresh() {
    listDocuments()
      .then(setDocuments)
      .catch((err) => setError(err.message));
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    setSelectedFileName(file?.name || "");
    // Only auto-fill if the user hasn't already typed a custom name.
    setDisplayName((prev) => prev || (file ? stripExtension(file.name) : ""));
  }

  async function handleUpload(e) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");
    try {
      const doc = await uploadDocument(file, displayName.trim());
      setDocuments((docs) => [doc, ...(docs || [])]);
      fileInputRef.current.value = "";
      setSelectedFileName("");
      setDisplayName("");
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this document? This can't be undone.")) return;
    try {
      await deleteDocument(id);
      setDocuments((docs) => docs.filter((d) => d.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRename(doc) {
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

  if (viewing) {
    return <DocumentViewer document={viewing} onBack={() => setViewing(null)} />;
  }

  return (
    <main className="shell">
      <div className="top-row">
        <h1>EHR Translator</h1>
        <p className="account">
          Signed in as {user.email} <button onClick={onSignOut}>Sign out</button>
        </p>
      </div>

      <p className="disclaimer" role="alert" aria-live="polite">
        This tool does not provide medical advice. It only helps explain the
        objective content of a document — always consult a qualified
        healthcare provider for interpretation and care decisions.
      </p>

      <button className="btn-link how-it-works-link" onClick={onShowHowItWorks}>
        How this works, and how your document is kept private →
      </button>

      <form className="upload-form" onSubmit={handleUpload}>
        <input
          ref={fileInputRef}
          id="file-upload"
          className="visually-hidden"
          type="file"
          accept="application/pdf"
          required
          onChange={handleFileChange}
        />
        <label className="btn" htmlFor="file-upload">
          Choose PDF
        </label>
        <span className="file-name">{selectedFileName || "No file chosen"}</span>
        <input
          type="text"
          placeholder="Name (optional)"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <button className="btn btn-primary" type="submit" disabled={uploading}>
          {uploading ? "Uploading…" : "Upload PDF"}
        </button>
      </form>

      {error && <p className="error-text" role="alert">{error}</p>}

      {documents === undefined && <p className="loading-state">Loading documents…</p>}
      {documents && documents.length === 0 && (
        <p className="empty-state">No documents uploaded yet.</p>
      )}
      {documents && documents.length > 0 && (
        <ul className="doc-list">
          {documents.map((doc) => (
            <li className="doc-row" key={doc.id}>
              <button className="doc-name" onClick={() => setViewing(doc)}>
                {doc.display_name}
              </button>
              <span className="status-chip">{doc.status}</span>
              <time>{new Date(doc.created_at).toLocaleDateString()}</time>
              <button className="btn-link" onClick={() => handleRename(doc)}>
                Rename
              </button>
              <button className="btn-link" onClick={() => handleDelete(doc.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
