import { useState } from "react";

// Mirrors DocumentViewer's own language list exactly — this demo previews
// the real feature, not a decorative approximation of it.
const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "zh-Hant", label: "繁體中文" },
];

// Synthetic PET/CT snippet, not a real patient — chosen because it's dense
// with exactly the kind of jargon a layperson would need explained.
const FINDINGS = [
  {
    term: "hypermetabolic",
    citation: "J Nucl Med · FDG uptake in inflammatory and infectious conditions",
    explanation: {
      en: "This area is burning sugar faster than the tissue around it, so it shows up bright on the scan. That happens with cancer — and also with infection or ordinary inflammation.",
      es: "Esta zona consume azúcar más rápido que el tejido de alrededor, por eso se ve brillante en el estudio. Ocurre con el cáncer, y también con una infección o una inflamación común.",
      "zh-Hant": "這個部位消耗糖分的速度比周圍組織快，因此在影像上顯得較亮。癌症會出現這種情形，感染或一般發炎也會。",
    },
  },
  {
    term: "paratracheal lymph node",
    citation: "Radiology · Thoracic lymph node anatomy and station mapping",
    explanation: {
      en: "A lymph node sitting beside the windpipe, on the right side of the chest. Lymph nodes are small filters spaced along the body's drainage system.",
      es: "Un ganglio linfático situado junto a la tráquea, en el lado derecho del tórax. Los ganglios son pequeños filtros repartidos por el sistema de drenaje del cuerpo.",
      "zh-Hant": "位於氣管旁、胸腔右側的一顆淋巴結。淋巴結是分布在身體引流系統沿線的小型過濾器。",
    },
  },
  {
    term: "SUVmax of 4.6",
    citation: "Eur J Nucl Med Mol Imaging · Standardised uptake value, interpretation and limits",
    explanation: {
      en: "A number for how bright the most intense point of that area is. It's a measurement, not a verdict — the same number means different things in different parts of the body.",
      es: "Un número que indica qué tan brillante es el punto más intenso de esa zona. Es una medida, no un veredicto: el mismo número significa cosas distintas en distintas partes del cuerpo.",
      "zh-Hant": "這個數字代表該部位最亮處有多亮。它是一項測量值，不是結論——同樣的數字在身體不同部位代表的意義並不相同。",
    },
  },
  {
    term: "physiologic",
    citation: "J Nucl Med · Normal variants in physiologic FDG distribution",
    explanation: {
      en: "Normal for a healthy body. The thyroid often takes up a little of the tracer in people with nothing wrong with it.",
      es: "Normal en un cuerpo sano. La tiroides suele captar un poco del trazador en personas que no tienen ningún problema.",
      "zh-Hant": "屬於正常現象。即使完全健康的人，甲狀腺也常會吸收少量示蹤劑。",
    },
  },
];

export default function DemoPreview() {
  const [language, setLanguage] = useState("en");
  const [hoveredTerm, setHoveredTerm] = useState(FINDINGS[0].term);

  function Term({ term, children }) {
    return (
      <button
        type="button"
        className={"term-highlight" + (hoveredTerm === term ? " term-highlight-active" : "")}
        onMouseEnter={() => setHoveredTerm(term)}
        onFocus={() => setHoveredTerm(term)}
        onClick={() => setHoveredTerm(term)}
      >
        {children}
      </button>
    );
  }

  return (
    <section className="demo-panel" aria-label="Sample of how a document is explained">
      <div className="demo-panel-head">
        <span className="pane-label">Sample report — synthetic data, not a real patient</span>
        <div className="lang-switch">
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
      </div>

      <div className="demo-grid">
        <div className="demo-doc-pane">
          <span className="pane-label">Original document — always in its own language</span>
          <p className="demo-doc-text">
            There is a <Term term="hypermetabolic">hypermetabolic</Term> right{" "}
            <Term term="paratracheal lymph node">paratracheal lymph node</Term> measuring 1.4 ×
            1.1 cm, with an <Term term="SUVmax of 4.6">SUVmax of 4.6</Term>.
          </p>
          <p className="demo-doc-text">
            No abnormal uptake within the liver, spleen, or adrenal glands. Mild diffuse uptake
            in the thyroid gland, likely <Term term="physiologic">physiologic</Term>.
          </p>
        </div>

        <div className="annotations-pane">
          <ol className="findings-list">
            {FINDINGS.map((item) => (
              <li
                className={"finding" + (hoveredTerm === item.term ? " finding-active" : "")}
                key={item.term}
                onMouseEnter={() => setHoveredTerm(item.term)}
              >
                <span className="finding-term">{item.term}</span>
                <span className="finding-explain">{item.explanation[language]}</span>
                <a className="citation" href="#pipeline">
                  {item.citation}
                </a>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <p className="demo-hint">
        Hover or tap a highlighted phrase, or switch languages above — this is the actual
        annotation view you'll get for your own documents, not a mockup.
      </p>
    </section>
  );
}
