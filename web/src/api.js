const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8001";

export function getToken() {
  return window.localStorage.getItem("authToken");
}

export function setToken(token) {
  if (token) {
    window.localStorage.setItem("authToken", token);
  } else {
    window.localStorage.removeItem("authToken");
  }
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (token) headers.Authorization = `Token ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body.detail || body.error || message;
    } catch {
      // response wasn't JSON — fall back to the generic message
    }
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

export function requestSignInLink(email) {
  return request("/api/auth/request-link/", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function fetchMe() {
  return request("/api/auth/me/");
}

export function logout() {
  return request("/api/auth/logout/", { method: "POST" });
}

export function listDocuments() {
  return request("/api/documents/");
}

export function deleteDocument(id) {
  return request(`/api/documents/${id}/`, { method: "DELETE" });
}

export function fetchAnnotations(id, language = "en") {
  return request(`/api/documents/${id}/annotations/?language=${language}`);
}

export async function fetchDocumentFile(id) {
  const token = getToken();
  const headers = {};
  if (token) headers.Authorization = `Token ${token}`;

  // A plain <iframe src="..."> load can't attach an Authorization header,
  // so the PDF is fetched here and handed to the viewer as a blob URL instead.
  const res = await fetch(`${API_BASE}/api/documents/${id}/file/`, { headers });
  if (!res.ok) throw new Error(`Failed to load file (${res.status})`);
  return res.blob();
}

export async function uploadDocument(file) {
  const token = getToken();
  const headers = {};
  if (token) headers.Authorization = `Token ${token}`;

  const formData = new FormData();
  formData.append("file", file);

  // Deliberately not using request() here — a multipart upload needs the
  // browser to set its own Content-Type (with the boundary), not the
  // "application/json" header request() always adds.
  const res = await fetch(`${API_BASE}/api/documents/`, {
    method: "POST",
    headers,
    body: formData,
  });
  if (!res.ok) {
    let message = `Upload failed (${res.status})`;
    try {
      const body = await res.json();
      message = body.detail || body.file?.[0] || message;
    } catch {
      // response wasn't JSON — fall back to the generic message
    }
    throw new Error(message);
  }
  return res.json();
}
