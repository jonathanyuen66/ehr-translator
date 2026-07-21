import { useEffect, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions, TextLayer } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const PAGE_SCALE = 1.3;

// Renders a PDF onto canvas (one per page) with an invisible, positioned text
// layer on top. Any of `terms` found in that text gets a highlight box drawn
// over it, and hovering a highlighted box reports the term up via
// onHoverTerm — that's what lets the annotation list light up in sync.
export default function PdfDocument({ url, terms, hoveredTerm, onHoverTerm }) {
  const containerRef = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const cleanupFns = [];

    async function render() {
      const container = containerRef.current;
      if (!container) return;
      container.innerHTML = "";

      const pdf = await getDocument({ url }).promise;
      if (cancelled) return;

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        if (cancelled) return;
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: PAGE_SCALE });

        const pageDiv = document.createElement("div");
        pageDiv.className = "pdf-page";
        pageDiv.style.width = `${viewport.width}px`;
        pageDiv.style.height = `${viewport.height}px`;

        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        pageDiv.appendChild(canvas);

        const textLayerDiv = document.createElement("div");
        textLayerDiv.className = "textLayer";
        textLayerDiv.style.setProperty("--total-scale-factor", String(viewport.scale));
        textLayerDiv.style.width = `${viewport.width}px`;
        textLayerDiv.style.height = `${viewport.height}px`;
        pageDiv.appendChild(textLayerDiv);

        container.appendChild(pageDiv);

        await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
        if (cancelled) return;

        const textLayer = new TextLayer({
          textContentSource: page.streamTextContent(),
          container: textLayerDiv,
          viewport,
        });
        await textLayer.render();
        if (cancelled) return;

        highlightTerms(textLayer, terms, onHoverTerm, cleanupFns);
      }
    }

    render().catch((err) => setError(err.message));

    return () => {
      cancelled = true;
      cleanupFns.forEach((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, terms]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.querySelectorAll(".term-highlight").forEach((el) => {
      el.classList.toggle("term-highlight-active", el.dataset.term === hoveredTerm);
    });
  }, [hoveredTerm]);

  if (error) return <p className="error-text" role="alert">{error}</p>;
  return <div ref={containerRef} className="pdf-pages" />;
}

// Finds each term inside this page's text and marks the overlapping spans so
// they can be styled and hovered. A term match is looked up against the
// page's flattened text, then any span whose own range overlaps the match is
// tagged — spans are pdf.js's existing per-run boxes, never split up, so a
// highlight can occasionally overshoot a term's exact edges by a few
// characters. That's an acceptable trade-off for not having to slice glyph
// positioning ourselves.
function highlightTerms(textLayer, terms, onHoverTerm, cleanupFns) {
  const strs = textLayer.textContentItemsStr;
  const divs = textLayer.textDivs;

  let flat = "";
  const ranges = [];
  strs.forEach((s, i) => {
    ranges.push({ div: divs[i], start: flat.length, end: flat.length + s.length });
    flat += s;
  });

  terms.forEach((term) => {
    // Word-spacing between pdf.js text runs is a heuristic and sometimes
    // comes out wrong (e.g. "cell" + "lung" extracted as "celllung") — matching
    // with \s* between words instead of a literal space tolerates that.
    const pattern = term
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\s+/g, "\\s*");
    const match = new RegExp(pattern, "i").exec(flat);
    if (!match) return;
    const start = match.index;
    const end = start + match[0].length;

    ranges
      .filter((r) => r.end > start && r.start < end && r.div)
      .forEach((r) => {
        r.div.classList.add("term-highlight");
        r.div.dataset.term = term;

        const onEnter = () => onHoverTerm?.(term);
        const onLeave = () => onHoverTerm?.(null);
        r.div.addEventListener("mouseenter", onEnter);
        r.div.addEventListener("mouseleave", onLeave);
        cleanupFns.push(() => {
          r.div.removeEventListener("mouseenter", onEnter);
          r.div.removeEventListener("mouseleave", onLeave);
        });
      });
  });
}
