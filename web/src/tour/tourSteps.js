// One entry per translated string in i18n `tour.steps` (see
// web/src/i18n/strings.js) — index-aligned, not merged into the same file,
// since this half is structural (which real element each step points at)
// while the other half is translated copy. `selector` is null for the
// intro step, which is centered with no spotlight.
export const TOUR_STEPS = [
  { selector: null },
  { selector: ".document-pane" },
  { selector: ".findings-list" },
  { selector: ".pdf-pages" },
  { selector: ".global-lang-switch" },
  { selector: ".ask-about-term-form" },
  { selector: ".viewer-head" },
];
