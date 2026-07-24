import { useEffect, useRef, useState } from "react";
import { fetchMe, logout, setToken } from "./api";
import SignIn from "./pages/SignIn";
import Dashboard from "./pages/Dashboard";
import HowItWorks from "./pages/HowItWorks";

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = signed out
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const callbackHandled = useRef(false);

  // Fired by api.js whenever a request comes back 401 mid-session (most
  // commonly: signed out from another tab or device — accounts share one
  // token, not one per session). Falls back to sign-in with an explanation
  // instead of leaving whatever screen was open showing a raw DRF error.
  useEffect(() => {
    function handleInvalidAuth() {
      setUser(null);
      setSessionExpired(true);
    }
    window.addEventListener("auth:invalid", handleInvalidAuth);
    return () => window.removeEventListener("auth:invalid", handleInvalidAuth);
  }, []);

  // Pick up the auth token from /auth/callback#token=... on first load.
  // Guarded by a ref (not just the [] dep array) because React StrictMode
  // double-invokes effects in development.
  useEffect(() => {
    if (callbackHandled.current) return;
    callbackHandled.current = true;

    const hash = window.location.hash;
    if (hash.startsWith("#token=")) {
      setToken(decodeURIComponent(hash.slice("#token=".length)));
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    fetchMe()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  async function handleSignOut() {
    try {
      await logout();
    } catch {
      // clearing the local token below is what actually matters
    }
    setToken(null);
    setUser(null);
  }

  if (showHowItWorks) {
    return <HowItWorks onBack={() => setShowHowItWorks(false)} />;
  }

  if (user === undefined) {
    return (
      <main className="shell">
        <p className="loading-state">Loading…</p>
      </main>
    );
  }

  return user ? (
    <Dashboard user={user} onSignOut={handleSignOut} onShowHowItWorks={() => setShowHowItWorks(true)} />
  ) : (
    <SignIn sessionExpired={sessionExpired} />
  );
}
