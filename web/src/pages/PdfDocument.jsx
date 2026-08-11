import { useEffect, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions, TextLayer } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import ExplainPopover from "./ExplainPopover";
import { useLanguage } from "../i18n";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// Selections shorter than this are almost always an accidental click/drag,
// not someone actually trying to select a phrase — no point popping up
// "Explain this" for a stray single character.
const MIN_SELECTION_LENGTH = 2;

// Bounds on the fit-to-width scale computed below — a floor so a page never
// renders illegibly small in a cramped viewport, a ceiling so a huge pane
// doesn't blow a page up into an oversized canvas.
const MIN_SCALE = 0.4;
const MAX_SCALE = 3.5;
const RESIZE_DEBOUNCE_MS = 150;

// Capped rather than used raw — device pixel ratio can run to 3+ on some
// phones, and the extra sharpness past 2x isn't worth quadrupling canvas
// memory/render time for a document viewer, not a photo editor.
const MAX_DEVICE_PIXEL_RATIO = 2;

// Renders a PDF onto canvas (one per page) with an invisible, positioned text
// layer on top. Any of `terms` found in that text gets a highlight box drawn
// over it, and hovering a highlighted box reports the term up via
// onHoverTerm — that's what lets the annotation list light up in sync.
//
// Each page is scaled to fit the container's width and stacked in normal
// document flow — pages render at their natural (fitted) height rather than
// being squeezed into a fixed-height box, so the surrounding page scrolls
// continuously through the whole document, the same as reading any other
// long web page.
export default function PdfDocument({
  url,
  terms,
  hoveredTerm,
  onHoverTerm,
  onTermClick,
  scrollToTerm,
  documentId,
  language,
  onExplained,
}) {
  const { t } = useLanguage();
  const containerRef = useRef(null);
  const pageElsRef = useRef([]);
  const [error, setError] = useState("");
  const [selection, setSelection] = useState(null); // { text, rect } | null
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    let cleanupFns = [];
    let renderToken = 0;
    let resizeTimer;
    let pdf;
    let pageObserver;
    let currentRenderTask;

    async function renderPages() {
      const container = containerRef.current;
      if (!container || !pdf) return;
      const myToken = ++renderToken;

      // Cancels whatever page render was still in flight from a previous
      // pass (a resize mid-render, or — the case that actually surfaced
      // this — React StrictMode's dev-only double-invoke of this effect,
      // which starts a second render before the first's worker-side
      // operation is told to stop). Left uncancelled, the abandoned
      // RenderTask's promise can end up never resolving at all, hanging
      // the *new* pass that's waiting on a fresh page.render() call
      // against the same still-busy worker.
      currentRenderTask?.cancel();

      container.innerHTML = "";
      cleanupFns.forEach((fn) => fn());
      cleanupFns = [];
      pageObserver?.disconnect();
      pageElsRef.current = [];

      const style = getComputedStyle(container);
      const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const targetWidth = Math.max(container.clientWidth - paddingX, 100);
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        if (cancelled || renderToken !== myToken) return;
        const page = await pdf.getPage(pageNum);

        const baseViewport = page.getViewport({ scale: 1 });
        const fitScale = targetWidth / baseViewport.width;
        const scale = Math.min(Math.max(fitScale, MIN_SCALE), MAX_SCALE);
        const viewport = page.getViewport({ scale });

        const pageDiv = document.createElement("div");
        pageDiv.className = "pdf-page";
        pageDiv.style.width = `${viewport.width}px`;
        pageDiv.style.height = `${viewport.height}px`;

        // The canvas's backing bitmap is rendered at `scale * dpr` — sharp
        // on high-density displays — while its CSS box stays at the
        // logical `viewport` size (set via width/height below), so the
        // extra pixels increase sharpness, not on-page size. Everything
        // else (pageDiv, textLayerDiv, highlight/selection math) stays on
        // the unscaled `viewport` throughout — only the canvas itself
        // renders at higher density.
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(viewport.width * dpr);
        canvas.height = Math.round(viewport.height * dpr);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        pageDiv.appendChild(canvas);

        const textLayerDiv = document.createElement("div");
        textLayerDiv.className = "textLayer";
        textLayerDiv.style.setProperty("--total-scale-factor", String(viewport.scale));
        textLayerDiv.style.width = `${viewport.width}px`;
        textLayerDiv.style.height = `${viewport.height}px`;
        pageDiv.appendChild(textLayerDiv);

        container.appendChild(pageDiv);
        pageElsRef.current.push(pageDiv);

        currentRenderTask = page.render({
          canvasContext: canvas.getContext("2d"),
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
        });
        try {
          await currentRenderTask.promise;
        } catch (err) {
          // A cancelled RenderTask rejects with its own internal
          // "RenderingCancelledException" rather than resolving — expected
          // whenever a newer renderPages() pass cancels this one above, not
          // a real failure to surface as the document's error state.
          if (err?.name === "RenderingCancelledException") return;
          throw err;
        }
        currentRenderTask = null;
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

        highlightTerms(textLayer, terms, onHoverTerm, onTermClick, cleanupFns);
      }

      if (cancelled || renderToken !== myToken) return;
      pageObserver = observeCurrentPage(pageElsRef.current, setCurrentPage);
    }

    async function load() {
      // disableStream/disableAutoFetch: blob: URLs can't serve HTTP range
      // requests anyway, and Safari's ReadableStream/range-request handling
      // for pdf.js has a history of being less reliable than Chromium's —
      // forcing a plain full-download avoids that class of issue entirely.
      pdf = await getDocument({ url, disableStream: true, disableAutoFetch: true }).promise;
      if (cancelled) return;
      setNumPages(pdf.numPages);
      setCurrentPage(1);
      await renderPages();
    }

    load().catch((err) => setError(err.message));

    // The container's available width can change for reasons besides a
    // window resize — e.g. the annotations sidebar being toggled resizes
    // the document column too — so this watches the container itself
    // rather than just window "resize", and recomputes layout only, not a
    // full reload of the PDF.
    //
    // Width-only, deliberately: renderPages() itself mutates this same
    // container (clearing it, then appending one page at a time), and now
    // that pages stack in normal flow instead of a fixed-height scrollbox,
    // the container's *height* grows with every page appended during that
    // very loop. Reacting to those self-inflicted height changes would
    // retrigger renderPages() mid-render, which retriggers more height
    // changes, and so on — a feedback loop that was especially visible
    // (glitchy, restarting mid-scroll) on anything with more than one page,
    // since more pages means more of the loop's own height changes for the
    // debounce window to catch. The fit-to-width scale only ever depends on
    // width anyway, so filtering to real width changes is both the fix and
    // the semantically correct behavior.
    // Seeded synchronously (not left to the observer's own guaranteed
    // initial callback) so that first callback — which reports this same
    // width, since nothing's changed yet — is correctly recognized as a
    // no-op instead of scheduling a redundant render pass.
    let lastWidth = containerRef.current.clientWidth;
    function handleResize(entries) {
      const newWidth = entries[0]?.contentRect.width;
      if (newWidth === undefined || Math.abs(newWidth - lastWidth) < 1) return;
      lastWidth = newWidth;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        renderPages().catch((err) => setError(err.message));
      }, RESIZE_DEBOUNCE_MS);
    }
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    return () => {
      cancelled = true;
      clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      cleanupFns.forEach((fn) => fn());
      pageObserver?.disconnect();
      currentRenderTask?.cancel();
      // Without this, the PDFDocumentProxy's worker/MessagePort are simply
      // abandoned rather than torn down — normally reclaimed eventually by
      // GC, but React StrictMode's dev-only double-invoke of this effect
      // fires it twice in a row for the same url, so a second load can
      // start before an un-destroyed first one has fully let go, and the
      // two can cross-talk over what should've been an already-dead
      // worker. destroy() is pdf.js's documented way to fully release a
      // loaded document, not something implied by just dropping the
      // reference.
      pdf?.destroy();
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

  // Scrolls to the highlighted span for a term explicitly clicked in the
  // findings list — keyed on `scrollToTerm.nonce`, not just `.term`, so
  // clicking the same finding twice in a row still re-scrolls (the term
  // string alone wouldn't change and this effect wouldn't re-fire).
  useEffect(() => {
    if (!scrollToTerm) return;
    const container = containerRef.current;
    if (!container) return;
    const el = container.querySelector(`[data-term="${CSS.escape(scrollToTerm.term)}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToTerm?.nonce]);

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
    // The page itself scrolls now (the container is no longer its own
    // scrollable box), so this has to listen on window, not the container.
    window.addEventListener("scroll", handleScroll);
    return () => {
      container.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  function goToPage(n) {
    const el = pageElsRef.current[n - 1];
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (error) return <p className="error-text" role="alert">{error}</p>;
  return (
    <div className="pdf-viewer">
      {/* Never a place to put React-rendered children — renderPages() above
          does container.innerHTML = "" and rebuilds it imperatively on every
          pass, which would silently desync from anything React thinks it
          owns underneath it. */}
      <div ref={containerRef} className="pdf-pages" />
      {numPages > 1 && (
        <div className="pdf-page-nav" aria-live="polite">
          <button
            type="button"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label={t("documentViewer.previousPage")}
          >
            ‹
          </button>
          <span>{t("documentViewer.pageIndicator", { current: currentPage, total: numPages })}</span>
          <button
            type="button"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= numPages}
            aria-label={t("documentViewer.nextPage")}
          >
            ›
          </button>
        </div>
      )}
      {selection && (
        <ExplainPopover
          documentId={documentId}
          language={language}
          selection={selection}
          onExplained={onExplained}
          onDismiss={() => setSelection(null)}
        />
      )}
    </div>
  );
}

// Tracks which page is most visible in the viewport and reports its 1-based
// index via setCurrentPage — an IntersectionObserver rather than a scroll
// listener so this stays cheap on long documents (the browser only notifies
// us when a page's visibility actually crosses a threshold, not on every
// scroll-position tick). root: null means "the browser viewport" — the page
// now scrolls as a whole rather than within its own scrollable container.
// Ratios are kept in a running map rather than trusted from a single
// callback batch, since the observer only reports the pages whose
// intersection changed since the last firing, not every observed page each
// time.
function observeCurrentPage(pageEls, setCurrentPage) {
  const ratios = new Map();
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => ratios.set(entry.target, entry.intersectionRatio));
      let bestEl = null;
      let bestRatio = -1;
      ratios.forEach((ratio, el) => {
        if (ratio > bestRatio) {
          bestRatio = ratio;
          bestEl = el;
        }
      });
      if (bestEl) {
        const idx = pageEls.indexOf(bestEl);
        if (idx !== -1) setCurrentPage(idx + 1);
      }
    },
    { root: null, threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] }
  );
  pageEls.forEach((el) => observer.observe(el));
  return observer;
}

// Finds each term inside this page's text and marks the overlapping spans so
// they can be styled and hovered. A term match is looked up against the
// page's flattened text, then any span whose own range overlaps the match is
// tagged — spans are pdf.js's existing per-run boxes, never split up, so a
// highlight can occasionally overshoot a term's exact edges by a few
// characters. That's an acceptable trade-off for not having to slice glyph
// positioning ourselves.
function highlightTerms(textLayer, terms, onHoverTerm, onTermClick, cleanupFns) {
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
        // A plain click (no drag) collapses/clears any selection before
        // this fires, so PdfDocument's own mouseup-based selection
        // handler sees no selected text and never opens ExplainPopover —
        // the two don't fight over the same click.
        const onClick = () => onTermClick?.(term);
        r.div.addEventListener("mouseenter", onEnter);
        r.div.addEventListener("mouseleave", onLeave);
        r.div.addEventListener("click", onClick);
        cleanupFns.push(() => {
          r.div.removeEventListener("mouseenter", onEnter);
          r.div.removeEventListener("mouseleave", onLeave);
          r.div.removeEventListener("click", onClick);
        });
      });
  });
}
