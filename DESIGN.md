---
name: CAMS recon
description: Calm, warm, light workspace for an internal reconciliation tool
colors:
  accent: "#5b4ccf"
  accent-deep: "#4a3cbd"
  accent-soft: "#efedfb"
  accent-ink: "#2f2785"
  green: "#2b7a4b"
  green-soft: "#e6f3eb"
  amber: "#9a5600"
  amber-soft: "#fbf0dc"
  rose: "#b4344a"
  rose-soft: "#fbe9eb"
  ink: "#1d1b18"
  ink-2: "#514d46"
  mute: "#736e66"
  line: "#e9e6df"
  line-2: "#dbd7ce"
  canvas: "#f7f6f2"
  card: "#ffffff"
  sunk: "#f2f0eb"
typography:
  greeting:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "46px"
    fontWeight: 400
    lineHeight: 1.04
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  number:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "44px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.035em"
  section:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 600
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "14.5px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
rounded:
  input: "10px"
  control: "12px"
  card-sm: "14px"
  card: "20px"
  pill: "999px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.card}"
    rounded: "{rounded.control}"
  button-primary-hover:
    backgroundColor: "{colors.accent-deep}"
  button-outline:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.input}"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.card}"
  now-tile-approve:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
  now-tile-sent-back:
    backgroundColor: "{colors.amber-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
  now-tile-failed:
    backgroundColor: "{colors.rose-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
  nav-item-active:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
---

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
