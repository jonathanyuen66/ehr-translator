import { useState } from "react";
import { requestSignInLink } from "../api";

export default function SignIn({ onShowHowItWorks }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("sending");
    setError("");
    try {
      await requestSignInLink(email);
      setStatus("sent");
    } catch (err) {
      setError(err.message);
      setStatus("idle");
    }
  }

  if (status === "sent") {
    return (
      <main className="shell">
        <h1 className="doc-title">Check your email</h1>
        <p className="disclaimer">
          We sent a sign-in link to <strong>{email}</strong>. Open it on this
          device to finish signing in.
        </p>
      </main>
    );
  }

  return (
    <main className="shell">
      <div className="top-row">
        <h1>EHR Translator</h1>
      </div>
      <p className="disclaimer">
        This app is invite-only. Enter your invited email to get a sign-in link.
      </p>
      <button className="btn-link how-it-works-link" onClick={onShowHowItWorks}>
        How this works, and how your document is kept private →
      </button>
      <form className="signin-form" onSubmit={handleSubmit}>
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button className="btn btn-primary" type="submit" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Send me a sign-in link"}
        </button>
      </form>
      {error && <p className="error-text" role="alert">{error}</p>}
    </main>
  );
}
