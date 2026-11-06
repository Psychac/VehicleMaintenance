# Vehicle Log: design audit (step 1 of 6)

Baseline: commit `700e29c`. Standard: `docs/DESIGN.md` (Sections 1 and 13 binding).
Method: static read of every component and `styles.css` (1,577 lines). **Not yet done:** real-device screenshots, contrast measurements, a Dynamic Type pass and a Chrome Performance profile. Findings marked *(verify)* need one of those. Nothing is changed in code yet.

Plan state: `[x]` done, `[ ]` to do.

- [x] 1. Audit
- [x] 2. Tokens (`src/design/tokens.ts`; accent petrol teal; 4 tabs; `motion` approved)
- [ ] 3. Components
- [ ] 4. Screens
- [ ] 5. Motion pass
- [ ] 6. Verify

---

## A. Inventory: screens and states

| # | Screen / surface | File | States that exist today | States missing |
|---|---|---|---|---|
| 1 | App boot | `App.tsx:128` | centered spinner on blank page | skeleton shell, delayed loading UI |
| 2 | DB init error | `App.tsx:119` | red banner + storage card | plain cause + one action (Retry), not a dev message |
| 3 | Auth (Supabase mode only) | `Auth.tsx` | signin, signup, busy, message | field-level validation, offline state, return-key labels |
| 4 | Shell: sidebar (≥900) / topbar + bottom tab bar (<900) | `App.tsx:154` | 6 tabs, overdue dot | tab-bar material, active-tab scroll-to-top, reduced tab count |
| 5 | No-vehicle empty | `App.tsx:240` | empty card | none (copy and styling only) |
| 6 | Data loading | `App.tsx:235` | centered spinner | skeletons |
| 7 | Banners (storage not persistent, notice, load error) | `App.tsx:225-233` | static paragraphs | offline banner, dismiss, retry action, pending-sync indicator |
| 8 | **Overview** | `Overview.tsx` | hero, 4 stats, quick actions, attention list, recent list; mini-empty states | loading, error, "all good" is OK |
| 9 | **Fuel** list + form | `FuelView.tsx` | empty, table, edit modal, busy | skeleton, undo for delete, inline validation, filtered-empty n/a |
| 10 | **Service** list + form + filter | `ServiceView.tsx` | empty, filtered empty, list, modal | skeleton, undo, search |
| 11 | **Reminders** list + 2 forms | `RemindersView.tsx` | empty, list, edit modal, mark-done modal | skeleton, completion moment, undo |
| 12 | **Reports** | `ReportsView.tsx` | range seg, bar chart, table toggle, category bars, line chart; text empty states | loading, scrub haptics/touch scrubbing on bar chart |
| 13 | **Settings** | `SettingsView.tsx` | vehicles list, backup, storage, account, vehicle modal | grouped-list layout, undo for delete vehicle |
| 14 | Storage settings form | `StorageSettings.tsx` | idle, busy, error msg, switching | segmented choice instead of radios-as-cards |
| 15 | Modal (all forms) | `Modal.tsx` | open/close | detents, drag-to-dismiss, grabber, focus trap, unsaved-input guard |
| 16 | Native dialogs | `shared.ts:11`, `SettingsView.tsx:80,228` | `window.confirm` ×3 | replace with undo toast / named-consequence sheet |
| 17 | Service worker / install | `public/sw.js`, manifest | shell cache, network-first | offline indicator in UI, maskable icon |

---

## B. Violations of Section 1 ("AI tells")

| Tell (S1 row) | Where | Evidence |
|---|---|---|
| **Gradients, glow, gradient surfaces** | Hero card, mobile header, brand mark, primary buttons, active nav | 13 `gradient` rules; `styles.css:187, 434-436, 445, 1334-1336, 1377, 1421-1422, 1569, 1575`. Indigo + teal radial "glow" on a navy gradient is the exact 2023 template look. Last commit is literally "dark-glow design system" |
| **Purple/indigo default accent** | whole app | `--accent: #5457e8`; also manifest `theme_color`, `index.html`, `icon.svg` |
| **Card soup** | Overview (4 stat cards + 2 list cards), Reports (3 cards), Settings (4 cards), every list is `.card` | `className="card"` on 20+ elements; stat cards each with their own tint, icon chip and label. Lists, settings and the stat row should be grouped lists or plain content |
| **Four tinted stat tiles** | `Overview.tsx:73-88`, `Stat` | `tint-1..4` = four unrelated hues (indigo, teal, amber, pink) = "accent used on everything" and breaks one-accent rule |
| **Border + shadow + tint on one surface** | `.card`, `.stat`, `.modal` | 28 `box-shadow`, borders from `--border`, tinted backgrounds all on the same elements *(verify per class)* |
| **Decorative icons on every label** | Stat tiles, list leading icons in Overview/Service/Reminders, sidebar, buttons ("Log fuel" has icon + label), `empty-icon` | Icons add no scan speed where the title is right there |
| **Emoji / glyphs as UI chrome** | `ReminderBadge.tsx:4` | `⚠ Overdue`, `◷ Due soon`, `✓ OK`, `? Not tracked`; text glyphs, also colour-coded (meaning by colour + glyph, no real icon) |
| **Centered hero + feature cards** | Empty states and Overview hero | Structure is fine; styling is the template look |
| **Spinners for loads** | `App.tsx:131, 237`; Auth button text "Please wait…" | No skeleton anywhere (0 `skeleton`/`shimmer` in CSS) |
| **Fade-in on everything, ease timings** | `page-in 0.22s ease-out` on every page change (`styles.css:167`), `fade-in 0.18s`, `sheet-up 0.25s cubic-bezier`, `pop-in` | Page entrance animation re-runs on every tab switch (S5.5 violation). No springs anywhere; there are 6 timed animations/transitions, 0 springs |
| **Buttons only change on release** | all buttons | Only `:active` rule count is **1** (`transform 0.08s`); press feedback is not spring, not on rows/cards/icons/tabs; hover is the main response (13 `:hover`, 0 `@media (hover: hover)`) so sticky hover on touch |
| **"Oops" / generic copy** | See section D | Raw `Error.message` shown to user; "Please wait…"; "Save", "Cancel", "Delete" (acceptable on a modal, not S9) |
| **Inconsistent spacing** | `styles.css` | gaps 2/6/8/10/12/16/20; paddings 5/9/10/14/18/24 px: 10, 6, 5, 9, 14, 18 are off-grid. Mixed `rem` and `px` |
| **Pure/default type** | `font-family: Inter, system-ui…` | Inter is declared but never loaded (no `@font-face`/link), so it falls back per-OS: inconsistent. 26 distinct font sizes (`0.65rem` to `2rem`) vs. an 11-step scale |
| **Dark mode = tinted blue-black "glow"** | `:root` dark | `#0b0b10`/`#14141b` are OK as layered elevation, but accent/tints are pastel neon (`#a4a7ff`, `#6fe0cb`, `#f59bbd`) |
| **Modal for everything** | Every create/edit flow uses a centered `.modal`; on phones it is a bottom sheet without detents or drag | S1 "Modal dialogs for everything" |
| **Tab bar with 6 tabs** | `App.tsx:17` | Overview, Fuel, Service, Reminders, Reports, Settings. Spec: 3-4 max |
| **Tables on phones** | `FuelView` `stack-table` | `table` reflowed with `data-label` pseudo-labels; not a list row |

---

## C. Violations of Section 13, per screen

Legend: **x** = fails, **~** = partial, **?** = cannot judge without device, **ok** = passes on read.
Columns: **Tok** tokens only · **Grid** 4-pt/aligned · **Radii** nested radii · **One** one primary/one accent/≤3 styles per row · **Tell** no S1 tells · **L/D** deliberate light and dark · **Press** touch-down · **Spring** springs + interruptible · **Cont** spatial continuity · **Hap** haptics · **Gest** gestures · **RM** Reduce Motion · **States** empty/loading/error/offline · **Shift** no layout shift · **Undo** destructive undoable · **Resp** responsive/adaptive · **DT** Dynamic Type · **A11y** VoiceOver/AA · **Perf**

| Screen | Tok | Grid | Radii | One | Tell | L/D | Press | Spring | Cont | Hap | Gest | RM | States | Shift | Undo | Resp | DT | A11y | Perf |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Boot / init error | x | ~ | ok | ok | x | ~ | n/a | x | x | n/a | n/a | ok | x | ? | n/a | ok | ? | ~ | ? |
| Auth | x | ~ | ? | ~ (3 links) | x | ~ | x | x | x | x | n/a | ok | ~ | ? | n/a | ok | ? | ~ | ? |
| Shell + nav | x | ~ | x | x (6 tabs, dot + badge) | x | ~ | x | x | x | x | x | ok | ~ | ok | n/a | ~ | ? | ~ | ? |
| Overview | x | ~ | x | x (2 CTAs + links) | x | ~ | x | x | x | x | x | ok | x | ~ | n/a | ~ | ? | ~ | ? |
| Fuel | x | ~ | ? | ~ | x | ~ | x | x | x | x | x | ok | ~ | ? | x | ~ | ? | ~ | ? |
| Service | x | ~ | ? | ~ | x | ~ | x | x | x | x | x | ok | ~ | ? | x | ~ | ? | ~ | ? |
| Reminders | x | ~ | ? | x (Add + per-row "Mark done" + badge) | x | ~ | x | x | x | x | x | ok | ~ | ? | x | ~ | ? | ~ | ? |
| Reports | x | ~ | ok | ok | x | ~ | x | x | x | x | ~ | ok | ~ | ok | n/a | ~ | ? | ~ | ? |
| Settings | x | ~ | ? | x (4 equal buttons + Add) | x | ~ | x | x | x | x | x | ok | ~ | ok | x | ~ | ? | ~ | ? |
| Modal / forms | x | ~ | ? | ~ | x | ~ | x | x | x | x | x | ok | ~ | ? | x | ~ | ? | x (no focus trap) | ? |

### Details behind the table

**Tokens (all screens).** A token layer exists (`:root` variables) but it is colour/shadow only. It has no type, spacing, motion tokens; 21 raw hex values and 29 `rgb()` outside `:root`; 26 distinct `font-size`s; ~15 distinct radii (3, 4, 6, 9, 10, 12, 18, 20, 22, 24, 99, 50%); the chart uses magic numbers (`W=600`, `H=220`, `PAD`); `ReportsView` inlines `style={{ background: 'var(--series-1)' }}`.

**Typography.** No scale. Page `h1` is `1.25rem` (20px), Overview hero uses `1.5-2rem` custom. No large title that collapses; no weight/size contrast pattern. 5 `text-transform: uppercase` rules (eyebrows, table headers): S3.1 allows caption-size small caps with +5% tracking only *(verify)*. `tabular` appears 4×, but not on all numeric columns *(verify)*.

**Colour.** No `label.primary/secondary/tertiary` opacity roles: separate `--text-2` grey is used. Success/warning/danger exist as bg+ink pairs (OK). `--accent-strong`, `--accent-soft`, 4 tints and 2 chart series = 8+ chromatic roles vs. "one accent". Contrast of `--text-2` `#5b6270` on `--surface-2` and of tint inks on tint backgrounds *(verify; compute in step 2)*.

**Elevation/material.** 28 `box-shadow`; 11 `backdrop-filter` (good: material exists) but the bar is not transparent-at-top/material-on-scroll; no Reduce Transparency handling. Shadow strings are bespoke, not the 2 spec levels. Dark mode uses shadows (`--shadow` `0 8px 24px`), spec says none plus hairline.

**Press feedback.** No row/card/tab/icon press states. `button:hover` is the primary affordance. Hover rules are not gated by `(hover: hover)`, so they stick on touch. Hit targets: sidebar/tab icons OK; `small-btn` ("Mark done"), `button.link`, `.tag`, and table rows need measurement *(verify ≥44)*.

**Motion.** 6 timed animations, 0 springs, 0 JS motion, 1 `prefers-reduced-motion` block (sets durations to 0.01ms globally: functional but does not substitute crossfades). Page entrance animation replays on every tab change because `<main key={tab}>`. No shared-element, no number transitions, no list insert/remove layout animation, no stagger. Modal opens with timed `sheet-up`. Charts do not animate. Completion moments (mark done, save) have none.

**Haptics.** None. Only Android supports Vibration API; plan is selection/impact/success/error mapping, no-op on iOS, with visual feedback as the primary channel. Error "shake" missing on forms.

**States.**
- Empty: present for Fuel, Service, Reminders, no-vehicle, Overview sub-cards. Copy is long (Fuel empty = 2 sentences with jargon) and illustration is a generic icon chip.
- Loading: spinner only (`App.tsx:131,237`). No skeletons, no 300 ms delay. First paint after DB init shows a blank spinner page.
- Error: banners dump `Error.message` (`App.tsx:233`, `SettingsView.tsx:57,85`, `Auth.tsx:25`, `ReminderForm`/`FuelForm` `setErr(ex.message)`). No Retry. Validation is on submit (`form-msg`) not on blur; no field-level error text.
- Offline: **none in UI.** The app is offline-first, so this is mostly "everything works", but there is no indicator for Supabase mode, no pending state, and the SW is network-first (a slow network blocks the shell instead of showing cache instantly) *(verify)*.
- Success: silent. Fine except Mark done and Restore (uses `msg` paragraph).

**Destructive actions.** Delete fill-up/service/reminder = `window.confirm("Delete this X? This can't be undone.")`; delete vehicle = `window.confirm` with ALL-CAPS; restore = `window.confirm`. Spec: undo toast (5 s) for reversible; named-consequence button for irreversible (vehicle delete with cascade). Requires a soft-delete/undo path in `lib/db.ts`: a data-layer task, flagged for step 3/4.

**Lists.** Fuel uses a `<table>` (reflowed) rather than rows; Overview/Settings/Reminders are `.list` inside `.card` (card around list, plus per-row icon chip). No swipe actions, no context menus, no row highlight on press, inset separators *(verify)*. Reminder row has 3 text styles + badge + button (limit is 3 text styles; two actions).

**Navigation.** Six tabs; the Settings tab doubles as "Add vehicle" entry for new users. Tapping the active tab does nothing (spec: scroll to top). Hash routing via `replaceState` means no history; edge-swipe back / browser back leaves the app (fine for tabs; there are no pushed screens). Vehicle picker is a native `<select>` (OK per "prefer native") but sits in topbar with brand name taking space.

**Layout / responsive.** Breakpoints: 380, 420, 480, 640, 900. Sidebar ≥900 is right. Mid-width (600-900) is a stretched phone layout, not a readable column *(verify)*. Safe-area insets used 8× (good). Largest text size not tested; many `rem` sizes will scale but sidebar/tab bar are fixed heights (`--nav-h: 64px`) so labels will clip *(verify)*.

**Accessibility.**
- Modal: `role="dialog"`/`aria-modal` OK, Escape OK, but **no focus trap, no focus restore, no initial focus**; overlay closes on mousedown (loses typed input) with no unsaved guard.
- `<div className="clickable" onClick>` on reminder rows and `<li className="clickable">` / `<tr onClick>` on Fuel/Service/Settings: **not keyboard-focusable, no role**. Real violation of S10.
- Tab bar uses `role="tablist"` on `<nav>` with buttons, but there are no `tabpanel`s and no arrow-key handling.
- Chart tooltips are mouse-only (`onMouseMove`/`onMouseEnter`): not touch-scrubbable, not keyboard accessible; charts have `aria-label` but no data alternative except the "Show table" link on one chart.
- Badge colour+glyph conveys state, but glyph chars are read aloud as symbols *(verify)*.
- `aria-live` is absent on banners and form messages.
- `<input type=date>` and `<select>` are native (good).
- Forms: `autoComplete` only on Auth; no `enterKeyHint`, no `autoCapitalize` choices. Labels are above fields (good) and wrap the input (good).

**Performance** *(verify all)*. No list virtualization (fine at this scale), but `Overview` recomputes everything each render, whole `data` reloaded via `listAll()` on every `visibilitychange`, and `App` re-renders the tree from root. `backdrop-filter` on 11 selectors and `box-shadow` on 28 are the likely paint cost on mid-range Android. Animations are CSS `transform/opacity` mostly (good). Cold start: SQLite WASM init blocks first meaningful paint; no cached shell paint of last-seen data.

**Copy.** See D.

---

## D. Copy: sample rewrites (full pass in step 4)

| Where | Today | Problem | Direction |
|---|---|---|---|
| Boot error | "Couldn't open the on-device database: {raw}" | raw message as headline | "Couldn't open your data. Close other Vehicle Log tabs and reload. [Reload]" + details disclosure |
| Storage warning | "This browser can't save the on-device database (OPFS unavailable). Data will be lost when you close or reload the page: download a backup in Settings. If the app is open in another tab, close it and reload." | 3 sentences, jargon | "Your data won't be saved in this browser. Download a backup. [Back up now]" |
| Fuel empty | "Log each fill with the fuel left before filling, or fill to full each time: efficiency is calculated between consecutive fills that have a known tank level." | explains method, not outcome | "No fill-ups yet" / "Add one to see your mileage." [Add fill-up] |
| Reminders empty | "Track oil changes, tyre rotation, insurance renewal and more so nothing sneaks up on you." | marketing tone | "Nothing to track yet" / "Add oil changes, insurance or tyres." [Add reminder] |
| Overview eyebrow | "Your vehicle" | placeholder | Show real data or omit |
| Overview | "Log service / expense" | slash-label | "Add service" |
| Buttons | "Save", "Cancel", "Delete", "+ Add vehicle" | generic; mixed `+` glyph and icon | "Save fill-up", "Delete fill-up", "Add vehicle" |
| Badge | "⚠ Overdue / ◷ Due soon / ✓ OK / ? Not tracked" | glyph chrome | "Overdue", "Due soon", "On track", "Not started" |
| Confirm | "Delete this fill-up? This can't be undone." | modal, no undo | Delete + toast "Fill-up deleted. [Undo]" |
| Vehicle delete | "Delete X and ALL of its … records? Consider archiving instead." | shouting | Sheet with button "Delete {name} and 42 entries"; secondary "Archive instead" |
| Auth | "Please wait…" | | Spinner in-button, width fixed |
| Reports | "Log at least three full-tank fill-ups to see a trend." | OK but tool-like | "Needs 3 full-tank fill-ups" |
| Numbers | `fmtKm`, `fmtMoney` formatting | *(verify)* locale and relative dates ("Yesterday") | check `lib/format.ts` in step 2 |
| Dates | absolute everywhere | S9: relative within 7 days | "Yesterday", "3 days ago", then absolute |

---

## E. What is already right (keep)

- Offline-first architecture, local-mode default, SQLite on OPFS.
- Light + dark via `prefers-color-scheme` with `data-theme` override.
- `viewport-fit=cover` + `env(safe-area-inset-*)` used.
- `inputMode`, native `<select>`/`<input type=date>`, labels above fields.
- Sidebar ≥900 / bottom bar <900 is the right size-class split.
- Charts are hand-built SVG, no gridline clutter, have a table alternative.
- Separate `lib/` logic with tests (`calc`, `merge`, `store`): the redesign must not touch these.

---

## F. Priorities and proposed plan

**Highest-traffic path** (drives order in step 4): *open app → "Add fill-up" → save → see what's due.*
Order: Overview → Fuel add form → Reminders → Service → Reports → Settings → Auth.

**Proposed decisions for step 2** (need your confirmation, see questions below):

1. **Accent.** Replace indigo `#5457e8`. Proposal: a deep **petrol teal**, light `#1F6B73` / dark `#5BB5BD` (to be AA-checked), on warm-grey tinted neutrals (hue ~60-80°, 2-4% sat). Reasoning: indigo/violet reads as "AI default"; petrol is calm and "precise", associated with instruments and enamel more than software. Alternative: **oxide red-brown** `#9A4A2E` (workshop / brake caliper): more distinctive, but near the destructive hue so would need a different destructive tone.
2. **Remove the second chromatic family.** One accent, status colours only for status; chart series = accent + a neutral (fuel = accent, service = label.secondary). Kills the 4 tints.
3. **Font.** Platform system stack only (`-apple-system, system-ui`), drop the unloaded `Inter`.
4. **Tabs 6 → 4:** *Home* (Overview), *Log* (Fuel + Service as a segmented view), *Reminders*, *More* (Reports, Settings). Alternative: keep Fuel/Service separate and fold Reports into Home. This changes the information architecture, so it's a decision, not a pure restyle.
5. **Motion library.** DESIGN.md S12 names `motion` (Framer Motion) for springs/layout/`AnimatePresence`. Adds a dependency (~30 KB gz for LazyMotion). Alternative: CSS `linear()` spring approximations (zero deps, less interruptible). Recommend `motion` for sheets/lists/shared-element and CSS for press states.
6. **Sheets.** Replace `Modal` with a drag-dismiss bottom sheet (detents) on touch, centered dialog on ≥900. Hand-rolled with `motion` drag vs. `vaul`. Recommend hand-rolled to avoid a second dependency.
7. **Undo for deletes.** Needs a deferred-delete in the data layer (hold the row for 5 s, commit on toast timeout). Affects `db.ts`/`store.ts`; I'd do it as a UI-level deferral first (hide row, delete after 5 s, flush on unload).
8. **Haptics.** `navigator.vibrate` on Android only, behind a `haptics.ts` with the S6.3 semantic names; no-op elsewhere. Visual feedback remains the baseline.

**Risks.**
- The CSS is one 1,577-line file with several overrides stacked on top of each other (e.g., `.nav button:hover` defined at 347, 1397, 1459; `button.primary:hover` at 756 and 1574; two hero gradients). Rewriting onto tokens means **replacing the file**, not patching it. "Remove before you add."
- Section 13 requires a real device. I can run the app and screenshot in a headless browser at 320/390/768/1280 in light/dark, but the iOS Safari/Android touch and haptic checks are yours to run.
- Tests (`calc`, `merge`, `store`) cover logic only; no UI tests exist. I'll verify visually and with `tsc` + `vitest`, not with regressions tests on UI.

---

## G. Questions before step 2

1. Accent: petrol teal (recommended) or oxide red-brown, or do you have a brand colour?
2. Tabs: 4 tabs with Fuel+Service merged into *Log* (recommended), or keep 5-6?
3. OK to add the `motion` dependency?
