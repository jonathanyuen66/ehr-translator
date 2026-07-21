import { useEffect, useRef, useState } from "react";
import { fetchMe, logout, setToken } from "./api";
import SignIn from "./pages/SignIn";
import Dashboard from "./pages/Dashboard";

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = loading, null = signed out
  const callbackHandled = useRef(false);

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

  if (user === undefined) {
    return (
      <main className="shell">
        <p className="loading-state">Loading…</p>
      </main>
    );
  }

  return user ? (
    <Dashboard user={user} onSignOut={handleSignOut} />
  ) : (
    <SignIn />
  );
}
