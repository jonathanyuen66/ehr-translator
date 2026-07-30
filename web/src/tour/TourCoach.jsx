import { useEffect, useState } from "react";
import { useLanguage } from "../i18n";
import { TOUR_STEPS } from "./tourSteps";

const SPOTLIGHT_PADDING = 8;
const CALLOUT_WIDTH = 340;
const MARGIN = 12;

// Tracks the live viewport rect of the element a step points at — re-queried
// on a MutationObserver (the target may not exist yet, e.g. annotations
// still loading) and kept current across resize/scroll, the same
// viewport-relative approach ExplainPopover.jsx already uses for its own
// positioning.
function useTargetRect(selector) {
  const [rect, setRect] = useState(null);

  useEffect(() => {
    if (!selector) {
      setRect(null);
      return;
    }

    let cancelled = false;
    let scrolledOnce = false;
    let observer = null;

    function measure() {
      const el = document.querySelector(selector);
      if (!el) return false;
      if (!scrolledOnce) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        scrolledOnce = true;
      }
      if (!cancelled) setRect(el.getBoundingClientRect());
      return true;
    }

    if (!measure()) {
      observer = new MutationObserver(() => measure());
      observer.observe(document.body, { childList: true, subtree: true });
    }

    function handleReflow() {
      measure();
    }
    window.addEventListener("resize", handleReflow);
    window.addEventListener("scroll", handleReflow, true);

    return () => {
      cancelled = true;
      observer?.disconnect();
      window.removeEventListener("resize", handleReflow);
      window.removeEventListener("scroll", handleReflow, true);
    };
  }, [selector]);

  return rect;
}

function calloutPosition(rect) {
  if (!rect) return null;
  const spaceBelow = window.innerHeight - rect.bottom;
  const top =
    spaceBelow > 200
      ? Math.min(rect.bottom + SPOTLIGHT_PADDING + 4, window.innerHeight - MARGIN)
      : Math.max(rect.top - SPOTLIGHT_PADDING - 4, MARGIN);
  const align = spaceBelow > 200 ? "top" : "bottom";
  const left = Math.min(Math.max(rect.left, MARGIN), window.innerWidth - CALLOUT_WIDTH - MARGIN);
  return { top, left, align };
}

export default function TourCoach({ onFinish }) {
  const { t } = useLanguage();
  const [stepIndex, setStepIndex] = useState(0);
  const step = TOUR_STEPS[stepIndex];
  const rect = useTargetRect(step.selector);
  const steps = t("tour.steps");
  const copy = steps[stepIndex];
  const isLast = stepIndex === TOUR_STEPS.length - 1;

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onFinish();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onFinish]);

  const pos = calloutPosition(rect);

  return (
    <>
      <div
        className="tour-backdrop"
        style={
          rect
            ? {
                top: rect.top - SPOTLIGHT_PADDING,
                left: rect.left - SPOTLIGHT_PADDING,
                width: rect.width + SPOTLIGHT_PADDING * 2,
                height: rect.height + SPOTLIGHT_PADDING * 2,
              }
            : undefined
        }
      />
      <div
        className="tour-callout"
        style={
          pos
            ? { top: pos.top, left: pos.left, width: CALLOUT_WIDTH }
            : { top: "50%", left: "50%", width: CALLOUT_WIDTH, transform: "translate(-50%, -50%)" }
        }
      >
        <p className="tour-step-count">{t("tour.stepCounter", { step: stepIndex + 1, total: TOUR_STEPS.length })}</p>
        <h3 className="tour-title">{copy.title}</h3>
        <p className="tour-body">{copy.body}</p>
        <div className="tour-actions">
          <button className="btn-link" onClick={onFinish}>
            {t("tour.skip")}
          </button>
          <div className="tour-actions-nav">
            {stepIndex > 0 && (
              <button className="btn" onClick={() => setStepIndex((i) => i - 1)}>
                {t("tour.back")}
              </button>
            )}
            <button
              className="btn btn-primary"
              onClick={() => (isLast ? onFinish() : setStepIndex((i) => i + 1))}
            >
              {isLast ? t("tour.done") : t("tour.next")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
