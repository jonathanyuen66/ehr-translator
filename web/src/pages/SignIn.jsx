import { useState } from "react";
import { requestSignInLink } from "../api";
import { HowItWorksContent } from "./HowItWorks";
import DemoPreview from "./DemoPreview";
import { Rich, useLanguage } from "../i18n";

const AUTHOR_EMAIL = "jonathanyuen66@gmail.com";

export default function SignIn({ sessionExpired }) {
  const { t } = useLanguage();
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
        <h1 className="doc-title">{t("signIn.checkEmailTitle")}</h1>
        <p className="disclaimer">
          <Rich text={t("signIn.checkEmailBody", { email })} />
        </p>
      </main>
    );
  }

  // Split around the literal address (rather than baking a translated
  // template around a <strong>/<a> pair) so the footer's surrounding wording
  // can reorder freely per language while the mailto link stays a real link.
  const [footerBefore, footerAfter] = t("signIn.footer", { email: AUTHOR_EMAIL }).split(AUTHOR_EMAIL);

  return (
    <main className="shell">
      <div className="top-row">
        <h1>PlainMed</h1>
      </div>

      {sessionExpired && (
        <p className="error-text" role="alert">
          {t("signIn.sessionExpired")}
        </p>
      )}

      <p className="hero-eyebrow">{t("signIn.heroEyebrow")}</p>
      <h2 className="doc-title">{t("signIn.heroTitle")}</h2>
      <p className="hero-sub">
        <Rich text={t("signIn.heroSub")} />
      </p>

      <p className="disclaimer">{t("signIn.inviteOnlyNotice")}</p>
      <form className="signin-form" onSubmit={handleSubmit}>
        <label htmlFor="signin-email" className="visually-hidden">
          {t("signIn.emailLabel")}
        </label>
        <input
          id="signin-email"
          type="email"
          required
          placeholder={t("signIn.emailPlaceholder")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button className="btn btn-primary" type="submit" disabled={status === "sending"}>
          {status === "sending" ? t("signIn.sending") : t("signIn.sendLink")}
        </button>
      </form>
      {error && <p className="error-text" role="alert">{error}</p>}

      <DemoPreview />

      <hr className="section-divider" />
      <HowItWorksContent headingLevel="h2" />

      <footer className="site-footer">
        {footerBefore}
        <a href={`mailto:${AUTHOR_EMAIL}`}>{AUTHOR_EMAIL}</a>
        {footerAfter}
      </footer>
    </main>
  );
}
