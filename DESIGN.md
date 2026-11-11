---
name: CAMS recon
description: Pastel money-app look for an internal reconciliation tool
colors:
  violet: "#7b61e8"
  violet-deep: "#6a4fdc"
  violet-soft: "#efe9ff"
  lilac: "#dccdfc"
  lilac-strong: "#c9b4f8"
  lilac-ink: "#3d2a78"
  pink: "#f7b6d7"
  pink-ink: "#6e1f4a"
  yellow: "#f8c63c"
  green: "#2f9e44"
  green-soft: "#e3f6e6"
  red: "#d6336c"
  red-soft: "#fde4ee"
  amber: "#b86e00"
  amber-soft: "#fff1d6"
  ink: "#16141c"
  ink-2: "#4a4655"
  mute: "#7d7889"
  canvas: "#eceaf2"
  card: "#ffffff"
  sunk: "#f4f2f8"
typography:
  display:
    fontFamily: "Urbanist, Inter, sans-serif"
    fontSize: "42px"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  number:
    fontFamily: "Urbanist, Inter, sans-serif"
    fontSize: "46px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.045em"
  title:
    fontFamily: "Urbanist, Inter, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Urbanist, Inter, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.45
  label:
    fontFamily: "Urbanist, Inter, sans-serif"
    fontSize: "12px"
    fontWeight: 600
rounded:
  input: "16px"
  row: "22px"
  card-sm: "24px"
  card: "30px"
  pill: "999px"
components:
  button-primary:
    backgroundColor: "{colors.violet}"
    textColor: "{colors.card}"
    rounded: "{rounded.pill}"
  button-primary-hover:
    backgroundColor: "{colors.violet-deep}"
  button-outline:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
  icon-button:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card}"
    rounded: "{rounded.pill}"
  input:
    backgroundColor: "{colors.sunk}"
    textColor: "{colors.ink}"
    rounded: "{rounded.input}"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.card}"
  field-card-lilac:
    backgroundColor: "{colors.lilac}"
    textColor: "{colors.lilac-ink}"
    rounded: "{rounded.card}"
  field-card-pink:
    backgroundColor: "{colors.pink}"
    textColor: "{colors.pink-ink}"
    rounded: "{rounded.card}"
  nav-item-active:
    backgroundColor: "{colors.lilac}"
    textColor: "{colors.lilac-ink}"
    rounded: "{rounded.pill}"
---

# Design System: CAMS recon

## Overview

**Creative North Star: "The Friendly Ledger"**

A reconciliation tool dressed like a consumer money app. The user pinned the reference: soft pastel fields, heavy rounded type, black round icon buttons, violet pill buttons and 3D clay objects. Colour fields tell you what kind of thing you are looking at; white cards hold the work.

The tokens live in `frontend/src/lilac.css`, which loads last and re-maps the older aurora tokens, so every screen picks the world up. Clay objects live in `frontend/public/art` and are placed with `components/Art.jsx`.

**Key Characteristics:**
- Lilac-grey canvas, white cards with 30px corners and no borders.
- Lilac and pink fields own whole cards: the first stat card in a row is lilac, the second pink, the rest white.
- Heavy Urbanist (800) for titles and numbers; 500 to 700 for everything else.
- One clay object per screen header, on a lilac or pink tile.

## Colors

Pastel fields on a cool lilac-grey ground, with one saturated violet for actions.

### Primary
- **Action Violet** (#7b61e8): primary buttons, links, focus rings, chart lines, the brand mark. Hover is #6a4fdc.

### Secondary
- **Lilac Field** (#dccdfc): the first field card, the active nav item, selected list rows, header art tiles. Text on it is Lilac Ink (#3d2a78).
- **Pink Field** (#f7b6d7): the second field card, nav count badges, money-out and problem screens' art tiles. Text on it is Pink Ink (#6e1f4a).

### Tertiary
- **Coin Yellow** (#f8c63c): highlights and warning dots only.

### Neutral
- **Ink** (#16141c): text, round icon buttons, the selected filter chip.
- **Ink 2** (#4a4655) and **Mute** (#7d7889): secondary text.
- **Canvas** (#eceaf2), **Card** (#ffffff), **Sunk** (#f4f2f8): page, cards, inputs and inner tiles.
- Status pairs: Green #2f9e44 on #e3f6e6, Amber #b86e00 on #fff1d6, Red #d6336c on #fde4ee.

### Named Rules
**The Field Rule.** Colour fills whole cards, never strips. No coloured left bars on rows or cards; a selected row turns lilac.

## Typography

**Display and body font:** Urbanist (with Inter, system sans).

**Character:** round, geometric and heavy at the top; friendly and plain in the body.

### Hierarchy
- **Display** (800, 42px, 1.02, -0.035em): screen titles and the Today greeting.
- **Number** (800, 46px, -0.045em): stat card values. Tabular numerals everywhere.
- **Title** (700, 19px): card and section titles, sentence case.
- **Body** (500, 15px): everything else.
- **Label** (600, 12px): table headers and small labels, sentence case, no tracking.

## Layout

Fixed white sidebar, translucent canvas topbar, content on the canvas. Screen headers put the title on the left and the clay object plus actions on the right. Stat cards sit in an auto-fit grid (min 230px). Below 900px the header art hides and titles drop to 34px.

## Elevation & Depth

Soft, offset, lilac-tinted shadows; no borders on cards.

### Shadow Vocabulary
- **Rest** (`0 1px 2px rgba(40,24,80,.04), 0 16px 34px -24px rgba(40,24,80,.22)`): cards and round buttons.
- **Raised** (`0 2px 4px rgba(40,24,80,.05), 0 26px 50px -26px rgba(40,24,80,.34)`): popovers, hovered cards.
- **Violet lift** (`0 12px 22px -14px rgba(106,79,220,.9)`): primary buttons.

## Shapes

Everything is round: 30px cards, 24px small cards, 22px rows, 16px inputs, pills for buttons, chips and nav items, circles for icon buttons and avatars.

## Components

- **Primary button:** violet pill, white bold text, violet lift shadow.
- **Outline button:** white pill with a hairline.
- **Icon button:** circle; white at rest, black on hover. Inside source and list rows the round action is black.
- **Input:** sunk fill, no border at rest, violet border and soft ring on focus.
- **Segmented views:** sunk track; the selected option is a white pill.
- **Stat card:** field colour by position, black badge circle, 46px number, a round arrow that turns black on hover.
- **Clay art:** `<HeroArt name tone />` in headers, `<Art name className />` elsewhere. Decorative and aria-hidden. Objects: coins, bank, card, clock, folder, clipboard, magnifier, gears, badges, cubes.

## Do's and Don'ts

- Do generate new clay objects with the prompt recorded in each `frontend/public/art/*.webp.json` so the set stays consistent.
- Do keep one object per screen header; never decorate rows or tables with art.
- Don't add borders to cards or coloured left bars to rows.
- Don't bring back the old blues (#2557ff, #11a2d0) or gradients on cards.
