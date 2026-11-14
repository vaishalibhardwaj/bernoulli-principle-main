---
name: CAMS recon
description: Calm, warm workspace modelled on the owner's reference design. Sand canvas, porcelain panels, orange pill actions, light large figures, moving charts.
tokens: frontend/src/theme/tokens.css
components: frontend/src/theme/system.css
look: frontend/src/theme/look.css
colors:
  canvas: "sand gradient #e8ddd3 to #f1efec"
  panel: "#f6f5f3"
  row: "#ffffff"
  accent: "#f2743b"
  accent-hover: "#e3612a"
  sage: "#8a9580"
  text: "#1b1d2e"
  text-2: "#55524d"
  text-3: "#6f6b65"
  ok: "#3d7651"
  warn: "#93590c"
  bad: "#b03a3a"
typography:
  family: "Inter, system-ui, sans-serif (one family; light weight for large figures; tabular figures everywhere)"
  title: { fontSize: "34px", fontWeight: 500, lineHeight: 1.15, letterSpacing: "-0.022em" }
  section: { fontSize: "16px", fontWeight: 600 }
  metric: { fontSize: "44px", fontWeight: 300, letterSpacing: "-0.03em" }
  body: { fontSize: "14px", fontWeight: 400, lineHeight: 1.5 }
  table: { fontSize: "13px" }
  label: { fontSize: "12px", fontWeight: 500 }
spacing: "4px base: 4, 8, 12, 16, 20, 24, 32, 40"
rounded:
  small: "10px"
  control: "14px"
  row: "22px"
  panel: "32px"
  button: "999px"
elevation: "Soft warm shadows on panels; stronger only for menus and the review window."
motion: "Controls 140-220ms. Charts draw in once (about 1s) and rest; one slow pulse on a live end point. Reduced motion shows finished charts."
---

## Rules of the system (13 Nov 2026, look updated the same day to the owner's reference)

- **One place for the look.** Every colour, type size, space, radius, shadow and duration is a token in `frontend/src/theme/tokens.css`. Component rules live in `frontend/src/theme/system.css` and read only those tokens. Older style sheets resolve to the same tokens through aliases at the bottom of the token file.
- **Colour.** Sand and porcelain by default. Orange for the main action. Side-menu icons carry their own tints, as in the reference. Green, amber and red mean state.
- **Status is a dot and a word**, never colour alone.
- **Amounts are right-aligned** in tabular figures.
- **Illustrations** are line drawings (`components/Art.jsx`), 1.5px stroke, neutral ink with one accent stroke. Used only in empty, done, drop-zone, no-access and error states.
- **Charts** follow the status colours when the series are statuses, carry a legend, a hover readout and a table view.
- **Approve and send back always confirm** in a dialog that states what will happen.
- **No descriptions under titles.** Page and section subtexts are hidden in theme/look.css.
- The earlier "Calm Day" look and the neutral indigo look are retired.

## Earlier notes (kept for history; superseded where they conflict with the rules above)


# Design System: CAMS recon

## Overview

**Creative North Star: "Calm Day"**

A workspace people sit in all day, so it is light, quiet and warm. A warm porcelain canvas, white cards on a hairline, one deep violet for actions, and soft tints only where something needs you. When there is nothing to do, the screen gets quieter, not emptier: tiles turn white with a green "All clear".

The tokens live in `frontend/src/calm.css`, which loads last and re-maps the older aurora tokens, so every screen picks the world up. Built to last ten years: plain structure, generous space, no trend effects.

**Key Characteristics:**
- Warm porcelain canvas, white 20px cards with a 1px warm hairline and a soft offset shadow.
- Colour means "this needs you". Violet tint for approvals, amber for sent back, rose for failures; everything else is neutral.
- Onest for the interface; Newsreader only for the greeting on a home screen.
- Each screen has one primary (violet) button for its next step.

## Colors

### Primary
- **Action Violet** (#5b4ccf): primary buttons, links, focus rings, the active menu icon, chart lines. Hover is #4a3cbd. Never used as a fill for large areas.

### Status (soft fill + strong text)
- **Approve tint** (#efedfb with #2f2785): approvals waiting.
- **Amber** (#9a5600 on #fbf0dc): sent back, pending.
- **Rose** (#b4344a on #fbe9eb): failed, rejected, cutoff missed.
- **Green** (#2b7a4b on #e6f3eb): done, active, "All clear".

### Neutral
- **Ink** (#1d1b18), **Ink 2** (#514d46), **Mute** (#736e66, passes 4.5:1 on canvas).
- **Canvas** (#f7f6f2), **Card** (#ffffff), **Sunk** (#f2f0eb), **Line** (#e9e6df), **Line 2** (#dbd7ce).

### Named Rules
**The Needs-You Rule.** A tint means there is work. When the count is zero the tile goes white and says "All clear". Never tint decoratively.

**The One Button Rule.** One violet button per screen or card: the next step. Everything else is outline or ghost.

## Typography

- **Greeting** (Newsreader 400, 46px): "Good afternoon, Meera" on Today and To do only.
- **Title** (Onest 600, 30px, -0.025em): screen titles.
- **Number** (Onest 600, 44px, tabular): counts in tiles.
- **Section** (Onest 600, 19px): section heads.
- **Body** (Onest 400, 14.5px). **Label** (Onest 600, 12px), sentence case, no tracking.
- No eyebrows or kickers above headings.

## Layout

Side menu on the canvas with a hairline edge; the active item is a white chip with a violet icon. Daily screens come first; rarely used ones (Cutoff times, File pickups, Scheduler monitor, Audit history) sit last in their group under a quiet "Less often" line; Administration is the last group. Topbar is translucent canvas with a hairline.

Home screens (Recon Ops: Today; Central Setup Team: To do) follow one order:
1. Greeting and date with the working AMC.
2. The "now" strip: Approvals waiting, Sent back to you, Files that failed, and Fund release cutoff (time left plus a bar for the working day from 9:00 to cutoff).
3. A section head naming the job ("Your queue, one at a time", "Check your teammates' changes") with its control on the right.
4. The work itself.

Later phases add tiles to the strip or groups to the menu; neither needs a redesign.

## Elevation & Depth

- **Rest** (`0 1px 2px rgba(48,40,28,.04), 0 10px 28px -20px rgba(48,40,28,.16)`) plus a 1px line: cards, tiles.
- **Raised** (`0 2px 6px rgba(48,40,28,.05), 0 26px 50px -26px rgba(48,40,28,.26)`): popovers, modals, hovered tiles.
- No glows, no glare, no gradients on cards.

## Shapes

20px cards, 14px small cards and rows, 12px buttons and controls, 10px inputs and icon buttons, pills only for chips and status.

## Components

- **Now tile** (`features/home/NowStrip.jsx`): label with a status dot, big number, one plain line saying what to do; tinted when the count is above zero, white with a green tick when clear. The whole tile is a button.
- **Cutoff tile:** time left, cutoff time, and a day bar with a "now" marker. Turns amber under 60 minutes and grey once passed.
- **Primary button:** violet, 12px corners, soft violet shadow. **Outline:** white with Line 2.
- **Segmented control:** sunk track; selected option is a white chip; counts sit in a small pill.
- **Clay art** (`components/Art.jsx`): only for empty and done states ("You're all clear", "Nothing sent back"). Never in headers, rows or tables.

## Do's and Don'ts

- Do let zero states look finished: white tile, green tick, plain sentence.
- Do keep one violet button per screen.
- Don't add borders thicker than 1px or coloured left bars.
- Don't bring back the pastel lilac/pink fields, the old blues (#2557ff, #11a2d0) or glow effects.
- Don't put an eyebrow or kicker above a heading.
