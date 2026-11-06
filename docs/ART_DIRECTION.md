# Vehicle Log: art direction (approved: "Clean")

Standard: `docs/DESIGN.md` Section 2 (Identity). History: round 1 of the redesign met the behaviour rules but looked like stock iOS (system font, gray rounded grouped lists everywhere, large-title bars, iOS controls). Two decorative directions (Logbook, Cluster) were rejected as too artistic for a tool used at a petrol pump. This is the approved direction.

## Brief

**Personality:** clean, functional, elegant, quietly precise.
**References:** good timetable and ledger typography, Linear and Things 3 for restraint, Braun-style product manuals. Nothing to copy visually; the goal is calm density and clear hierarchy.

**Signature elements (kept small on purpose)**
1. **Type:** Geist (sans) for everything, Geist Mono for the odometer figure only. Tabular numerals. Self-hosted through `@fontsource-variable` (Google Fonts, offline-safe, ~67 KB for the Latin and Latin-extended subsets, the latter needed for the ₹ sign).
2. **Colour:** cool, flat neutrals tinted toward the accent; one accent, deep petrol teal (`#0D5C63` light, `#62BFC6` dark); status colours only for status. Dark mode is layered cool charcoal, not inverted.
3. **Shape:** one small, crisp radius family (4 / 6 / 8 / 12 / 16); no squircle pills, no rounded gray containers.
4. **Separation:** whitespace and hairlines only. No cards, no grouped boxes, shadows only on overlays.
5. **Motion:** calm, high-damping springs (unchanged system); one functional signature.

**Signature moment (functional, not decorative):** every reminder carries a thin progress line under its title showing how much of its interval is used (e.g. 4,480 of 5,000 km): neutral, amber near due, red when overdue. Marking it done refills the line. The odometer figure rolls digit by digit after a fill-up.

## What changes in the app

| Area | Now | Clean |
|---|---|---|
| Lists | rounded white blocks on gray | flat rows on the page, hairline dividers, section labels |
| Headers | large collapsing title on every root screen | compact left-aligned header with the vehicle name |
| Home | hero + two grouped boxes | odometer figure, due list with progress lines, 2-column summary block with hairlines |
| Segmented control | iOS pill | underline switch |
| Toggle, sheet, toast | iOS shapes | plain, small radii, same behaviour |
| Tab bar | outline icons, iOS proportions | simpler, fewer icons, label-led |
| Icons | generic set | same set, 1.5 stroke, only where faster than a word |

## Plan (redo of the six steps, engine reused)

1. Audit: done (`docs/AUDIT.md` + identity audit in the previous version of this file).
2. Art direction: this document.
3. **Tokens: done** (fonts, type scale, radii, palette, shadows tuned).
4. Components: restyle primitives; add flat `List`, compact header, underline switch, progress line.
5. Screens: recompose Home, Log, Reminders, More to the flat layout.
6. Motion pass: re-tune, add progress-line refill.
7. Verify: re-run `scripts/verify-ui.mjs`, add the hide-the-logo review.
