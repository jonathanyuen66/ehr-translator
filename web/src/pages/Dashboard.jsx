import { useEffect, useRef, useState } from "react";
import { deleteDocument, listDocuments, uploadDocument } from "../api";
import DocumentViewer from "./DocumentViewer";

export default function Dashboard({ user, onSignOut }) {
  const [documents, setDocuments] = useState(undefined); // undefined = loading
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    refresh();
  }, []);

  function refresh() {
    listDocuments()
      .then(setDocuments)
      .catch((err) => setError(err.message));
  }

  async function handleUpload(e) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");
    try {
      const doc = await uploadDocument(file);
      setDocuments((docs) => [doc, ...(docs || [])]);
      fileInputRef.current.value = "";
      setSelectedFileName("");
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

      <form className="upload-form" onSubmit={handleUpload}>
        <input
          ref={fileInputRef}
          id="file-upload"
          className="visually-hidden"
          type="file"
          accept="application/pdf"
          required
          onChange={(e) => setSelectedFileName(e.target.files?.[0]?.name || "")}
        />
        <label className="btn" htmlFor="file-upload">
          Choose PDF
        </label>
        <span className="file-name">{selectedFileName || "No file chosen"}</span>
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
                {doc.original_filename}
              </button>
              <span className="status-chip">{doc.status}</span>
              <time>{new Date(doc.created_at).toLocaleDateString()}</time>
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
