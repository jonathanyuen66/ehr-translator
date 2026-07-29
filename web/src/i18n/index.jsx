import { createContext, useContext, useMemo, useState } from "react";
import { translations } from "./strings";

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "zh-Hant", label: "繁體中文" },
];

const STORAGE_KEY = "plainmed:language";

const LanguageContext = createContext(null);

function readStoredLanguage() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return LANGUAGES.some((l) => l.code === stored) ? stored : "en";
  } catch {
    // Storage can throw in private-browsing modes in some browsers — falling
    // back to English rather than crashing the whole app over a preference.
    return "en";
  }
}

// Looks up a dot-path ("dashboard.addReport.title") in the current
// language's string tree, falling back to English so a key missing from a
// translation (e.g. one just added) still renders something instead of
// `undefined`.
function lookup(language, path) {
  const segments = path.split(".");
  let node = translations[language];
  for (const segment of segments) {
    node = node?.[segment];
  }
  if (node !== undefined) return node;

  let fallback = translations.en;
  for (const segment of segments) {
    fallback = fallback?.[segment];
  }
  return fallback;
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(readStoredLanguage);

  function setLanguage(code) {
    setLanguageState(code);
    try {
      window.localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // Same private-browsing consideration as above — losing persistence
      // is fine, losing the ability to switch language at all isn't.
    }
  }

  const value = useMemo(() => {
    function t(path, vars) {
      const value = lookup(language, path);
      if (typeof value === "function") return value(vars);
      if (typeof value === "string" && vars) {
        return value.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");
      }
      return value;
    }
    return { language, setLanguage, t };
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}

// A minimal, deliberately non-nesting markdown subset for the handful of
// translated strings that need inline emphasis: **bold**, _italic_, and
// `code`. Anything fancier belongs in real JSX in the component, not here.
export function Rich({ text }) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("_") && part.endsWith("_")) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i}>{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

export function LanguageSwitch() {
  const { language, setLanguage } = useLanguage();
  return (
    <div className="lang-switch global-lang-switch" aria-label="Site language">
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          className={l.code === language ? "active" : ""}
          onClick={() => setLanguage(l.code)}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
