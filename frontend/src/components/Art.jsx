// Line illustrations for empty, done, first-run, drop-zone and error states only. Never on working screens.
// One style: 1.5px strokes, round caps, the neutral ink of the design system, with a single accent stroke (class "a").
// Decorative: always aria-hidden. Colours come from theme/tokens.css through the .ds-art rules.
import React from "react";

const P = {
  // All drawn on a 96 x 96 grid.
  clipboard: <><rect x="24" y="20" width="48" height="60" rx="6" /><path d="M38 20v-2a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v2" /><path d="M38 20h20v6H38z" /><path className="a" d="M37 52l8 8 15-17" /></>,
  badges: <><circle cx="48" cy="46" r="24" /><path className="a" d="M37 46l8 8 15-16" /><path d="M20 78h56" /><path d="M30 86h36" /></>,
  folder: <><path d="M16 30a6 6 0 0 1 6-6h16l8 8h28a6 6 0 0 1 6 6v32a6 6 0 0 1-6 6H22a6 6 0 0 1-6-6z" /><path className="a" d="M38 54l7 7 14-15" /></>,
  clock: <><circle cx="48" cy="48" r="30" /><path className="a" d="M48 30v18l12 8" /><path d="M48 14v4M48 78v4M14 48h4M78 48h4" /></>,
  upload: <><path d="M26 62a16 16 0 0 1 3-31.700 20 20 0 0 1 38 4A14 14 0 0 1 70 62" /><path className="a" d="M48 80V46" /><path className="a" d="M36 58l12-12 12 12" /></>,
  empty: <><path d="M16 52l10-26a4 4 0 0 1 4-2.500h36a4 4 0 0 1 4 2.500l10 26" /><path d="M16 52v18a6 6 0 0 0 6 6h52a6 6 0 0 0 6-6V52H62a14 14 0 0 1-28 0z" /><path className="a" d="M40 36h16" /></>,
  lock: <><rect x="24" y="42" width="48" height="36" rx="6" /><path d="M34 42v-8a14 14 0 0 1 28 0v8" /><path className="a" d="M48 56v8" /></>,
  error: <><path d="M48 16l34 60H14z" /><path className="a" d="M48 40v18" /><path className="a" d="M48 66v.500" /></>,
  search: <><circle cx="42" cy="42" r="22" /><path d="M58 58l20 20" /><path className="a" d="M34 42h16" /></>,
};
// Older names used around the app map onto the set above.
const ALIAS = { coins: "empty", bank: "empty", card: "empty", magnifier: "search", gears: "clock", cubes: "empty" };

/** name: clipboard | badges | folder | clock | upload | empty | lock | error | search */
export function Art({ name, className = "", size = 72 }) {
  const body = P[name] || P[ALIAS[name]] || P.empty;
  return (
    <svg className={"ds-art " + className} width={size} height={size} viewBox="0 0 96 96" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {body}
    </svg>
  );
}
