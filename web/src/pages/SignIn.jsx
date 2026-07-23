import { useState } from "react";
import { requestSignInLink } from "../api";
import { HowItWorksContent } from "./HowItWorks";
import DemoPreview from "./DemoPreview";

export default function SignIn() {
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
        <h1>PlainMed</h1>
      </div>

      <p className="hero-eyebrow">Scan reports &amp; doctor's notes</p>
      <h2 className="doc-title">Written for a doctor. Explained for you.</h2>
      <p className="hero-sub">
        Upload a report and read it beside a plain-language explanation of every term it
        assumes you already know — in <strong>English, Spanish, or Traditional Chinese</strong>,
        with a link to the published research behind each one.
      </p>

      <p className="disclaimer">
        This app is invite-only. Enter your invited email to get a sign-in link.
      </p>
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

      <DemoPreview />

      <hr className="section-divider" />
      <HowItWorksContent />
    </main>
  );
}
