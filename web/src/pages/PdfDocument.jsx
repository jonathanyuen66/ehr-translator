import { useEffect, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions, TextLayer } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import ExplainPopover from "./ExplainPopover";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// Selections shorter than this are almost always an accidental click/drag,
// not someone actually trying to select a phrase — no point popping up
// "Explain this" for a stray single character.
const MIN_SELECTION_LENGTH = 2;

// Bounds on the fit-to-page scale computed below — a floor so a page never
// renders illegibly small in a cramped viewport, a ceiling so a huge pane
// doesn't blow a page up into an oversized canvas.
const MIN_SCALE = 0.4;
const MAX_SCALE = 3.5;
const RESIZE_DEBOUNCE_MS = 150;

// Renders a PDF onto canvas (one per page) with an invisible, positioned text
// layer on top. Any of `terms` found in that text gets a highlight box drawn
// over it, and hovering a highlighted box reports the term up via
// onHoverTerm — that's what lets the annotation list light up in sync.
//
// Each page is scaled to fit fully inside the container (both width and
// height) so a single page never needs internal scrolling to see all of it —
// with multiple pages, you scroll *between* pages, never within one.
export default function PdfDocument({ url, terms, hoveredTerm, onHoverTerm, documentId, language, onExplained }) {
  const containerRef = useRef(null);
  const [error, setError] = useState("");
  const [selection, setSelection] = useState(null); // { text, rect } | null

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    let cleanupFns = [];
    let renderToken = 0;
    let resizeTimer;
    let pdf;

    async function renderPages() {
      const container = containerRef.current;
      if (!container || !pdf) return;
      const myToken = ++renderToken;

      container.innerHTML = "";
      cleanupFns.forEach((fn) => fn());
      cleanupFns = [];

      const style = getComputedStyle(container);
      const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const targetWidth = Math.max(container.clientWidth - paddingX, 100);
      const targetHeight = Math.max(container.clientHeight - paddingY, 100);

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        if (cancelled || renderToken !== myToken) return;
        const page = await pdf.getPage(pageNum);

        const baseViewport = page.getViewport({ scale: 1 });
        const fitScale = Math.min(targetWidth / baseViewport.width, targetHeight / baseViewport.height);
        const scale = Math.min(Math.max(fitScale, MIN_SCALE), MAX_SCALE);
        const viewport = page.getViewport({ scale });

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
        if (cancelled || renderToken !== myToken) return;

        // getTextContent() (a plain resolved object) rather than
        // streamTextContent() (a ReadableStream) — sidesteps Safari's
        // historically less complete ReadableStream support, which is a
        // documented source of pdf.js failures specifically on Safari.
        const textContent = await page.getTextContent();
        const textLayer = new TextLayer({
          textContentSource: textContent,
          container: textLayerDiv,
          viewport,
        });
        await textLayer.render();
        if (cancelled || renderToken !== myToken) return;

        highlightTerms(textLayer, terms, onHoverTerm, cleanupFns);
      }
    }

    async function load() {
      // disableStream/disableAutoFetch: blob: URLs can't serve HTTP range
      // requests anyway, and Safari's ReadableStream/range-request handling
      // for pdf.js has a history of being less reliable than Chromium's —
      // forcing a plain full-download avoids that class of issue entirely.
      pdf = await getDocument({ url, disableStream: true, disableAutoFetch: true }).promise;
      if (cancelled) return;
      await renderPages();
    }

    load().catch((err) => setError(err.message));

    // The container's available size depends on the viewport (sticky,
    // viewport-height document pane), so a window resize can change how
    // much room a page has to fit into — recompute layout only, not a full
    // reload of the PDF itself.
    function handleResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        renderPages().catch((err) => setError(err.message));
      }, RESIZE_DEBOUNCE_MS);
    }
    window.addEventListener("resize", handleResize);

    return () => {
      cancelled = true;
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", handleResize);
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

  // A new document means any pending selection popover is now pointing at
  // text that no longer exists on screen.
  useEffect(() => {
    setSelection(null);
  }, [url]);

  // Lets the reader select any phrase — not just the pre-highlighted
  // findings above — and ask for an explanation of it specifically. Scroll
  // dismisses rather than repositions: a fixed-position popover would
  // otherwise visually drift away from the text it's actually anchored to.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function handleMouseUp() {
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : "";
      if (!text || text.length < MIN_SELECTION_LENGTH || sel.rangeCount === 0) return;
      if (!container.contains(sel.anchorNode)) return;

      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      setSelection({ text, rect });
    }

    function handleScroll() {
      setSelection(null);
    }

    container.addEventListener("mouseup", handleMouseUp);
    container.addEventListener("scroll", handleScroll);
    return () => {
      container.removeEventListener("mouseup", handleMouseUp);
      container.removeEventListener("scroll", handleScroll);
    };
  }, []);

  if (error) return <p className="error-text" role="alert">{error}</p>;
  return (
    <>
      {/* Never a place to put React-rendered children — renderPages() above
          does container.innerHTML = "" and rebuilds it imperatively on every
          pass, which would silently desync from anything React thinks it
          owns underneath it. */}
      <div ref={containerRef} className="pdf-pages" />
      {selection && (
        <ExplainPopover
          documentId={documentId}
          language={language}
          selection={selection}
          onExplained={onExplained}
          onDismiss={() => setSelection(null)}
        />
      )}
    </>
  );
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
