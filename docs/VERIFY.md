# Vehicle Log: verification report (step 6 of 6)

Standard: `docs/DESIGN.md` Section 13 (definition of done) and Section 11 (performance).
Method: `scripts/verify-ui.mjs` drives headless Edge over CDP against the **production build** (`vite build` + `vite preview`). It seeds 60 fill-ups, 14 services and 4 reminders through the app's own Restore flow, then audits every screen and sheet. Re-run it with:

```
npx vite build && npx vite preview --port 5198
node scripts/verify-ui.mjs http://localhost:5198 report.json   # PERF_ONLY=1 to skip the audits
```

**Not verified (needs a real device, and is still owed per DESIGN.md S0.6):** VoiceOver/TalkBack reading order, Android haptics, how touch and swipes *feel*, the OS Dynamic Type setting (simulated here by 200% root font size), 60 fps on actual mid-range hardware (simulated here with a 4x CPU throttle), iOS Safari behaviour. Nothing below replaces that pass.

## Result summary

| Area | Result |
|---|---|
| Tokens only (no raw hex/rgb/px font/radius; JS durations and easings) | **Pass** (after fix, see below) |
| Contrast AA, both themes, every screen and sheet (computed from rendered colours) | **Pass**, 0 failures |
| Touch targets >= 44 x 44 | **Pass** (after fix) |
| Labels on every button and field | **Pass**, 0 unlabeled |
| No horizontal overflow at 320 px | **Pass** |
| Adapted layout on desktop (sidebar + readable column, sheet becomes dialog) | **Pass** |
| Large text (200%): nothing clipped, rows reflow | **Pass** (after fix) |
| Layout shift (CLS) < 0.05 | **Pass**, 0 on a real cold start and across all tab taps |
| Touch-down feedback in the same frame | **Pass** |
| Scroll frame rate, 60-row list | **Pass**, locked 60 fps even at 4x throttle |
| Tab/route transitions, no dropped frames | **Pass at 1x. Fail at 4x throttle** (see below) |
| Tap-to-navigation < 100 ms | **Pass at 1x** (50-86 ms). **Fail at 4x** (127-454 ms) |
| Cold start to content < 1 s | **Pass at 1x** (424 ms). **Fail at 4x** (1.57 s) |
| LCP < 2.0 s | **Pass** (396 ms at 1x, 1.56 s at 4x) |
| Haptics on a real phone, VoiceOver, real Dynamic Type | **Not verified** |
| Skeleton states reachable | **Partial**: they exist and are covered by code review, but loading is too fast to screenshot on seeded data |

## Section 13, per area

Screens audited: Home, Log (fuel), Log (service), Reminders, More, Reports, Vehicles, Backup, Storage, no-vehicle empty state, and the sheets Add fill-up, Reminder detail, Vehicle picker. Configurations: phone 390 light, 390 dark, 320 light, desktop 1100, phone 390 at 200% text.

**Visual**
- [x] Only tokens used. Scan finds no hex or `rgb()` outside `src/design/`, no raw font-size or radius in `ui.css` / `app.css`. Remaining literals are hairline/ring widths and SVG geometry, both documented in the file headers.
- [x] 4-pt grid: all spacing comes from `--space-*` (one 2 px step is a documented token).
- [x] Nested radii: segmented pill = outer - padding; menu items and sheet parts follow the same rule.
- [x] One primary action per screen, one accent (petrol teal); max 3 text styles per row (title, subtitle, value).
- [x] AI tells from S1: gradients, glow, tinted stat tiles, emoji badges, `window.confirm`, and "Oops" copy are all removed (see AUDIT.md).
- [x] Light and dark: contrast verified on every rendered text element in both themes.

**Motion and interaction**
- [x] Every tappable element responds on touch-down (`data-pressed` set in the same task as `pointerdown`; measured true immediately after a real touch-start).
- [x] All movement uses spring tokens; fades use the fade tokens (JS and CSS share one definition, covered by a unit test).
- [x] Entering and leaving elements keep continuity (sheet, toast, menu, list rows, screen push/back).
- [x] Haptics fire only on the S6.3 events (code review; can't be felt in a headless browser).
- [x] Gestures: edge-swipe back, swipe actions, sheet drag, pull-to-refresh track the finger and use release velocity (tested earlier with touch emulation).
- [x] Reduce Motion: every transition collapses to a crossfade.

**States**
- [~] Empty, loading, error, offline states exist for every screen. Empty and error were exercised; loading skeletons are delayed 300 ms and weren't caught in screenshots; offline banner applies only in Supabase mode (SQLite is local).
- [x] No layout shift when data arrives (CLS 0).
- [x] Destructive actions undoable (toast with Undo, 5 s) or confirmed with a named consequence (vehicle delete).

**Responsiveness and access**
- [x] 320 px: no overflow on any screen or sheet. Desktop: sidebar and centred column.
- [x] 200% text: nothing clipped; row trailing values wrap below the text.
- [ ] VoiceOver/TalkBack: **not verified on device.** Automated: every button and field has an accessible name; sheets trap focus and restore it; menus and segmented controls are keyboard operable.
- [x] Contrast AA in both themes.

**Performance**
- [x] 1x: zero dropped frames on scroll and on every tab transition; no long tasks.
- [ ] Mid-range device: **fails at 4x throttle** for transitions and navigation start (below).
- [x] Cached content shows instantly on revisit (revisit transitions at 1x: 17 ms max frame).

## Findings fixed during this step

| Finding | Fix |
|---|---|
| Segmented control segments were 40 px tall (target 44) | Control is 48 px with a 44 px segment |
| At 200% text, a row's trailing badge squeezed the subtitle to ~50 px | Rows wrap; text basis 8rem, trailing content drops below |
| At 200% text, the Back button collapsed to 24 px wide | Icon buttons no longer shrink; header sides keep a 44 px minimum |
| 16 JS animations hard-coded durations and easings | One `fadeMotion` token export derived from the CSS tokens |
| Log mounted all history rows at once (tab switch 700 ms at 4x) | History shows 25 rows with a "Show older" row (now 317 ms) |
| **Regression I introduced and the verifier caught:** a stripped backslash in the new `fadeMotion` regex produced `cubic-bezier(NaN…)` and crashed Log and Reminders | Fixed; added unit tests so it can't recur silently |
| Segmented pill could animate from a wrong position (reported by user) | Pill is now a single CSS `translateX(index * 100%)` transition; it cannot animate on mount |
| Service worker could serve a stale `index.html` via the browser HTTP cache | Page loads bypass the HTTP cache; cache name bumped to v2 |

## Still failing (be honest)

At a 4x CPU throttle (a rough stand-in for a mid-range phone):

| Metric | Target | Measured at 4x |
|---|---|---|
| Cold start to first content | < 1 s | 1.57 s |
| Tap to navigation start | < 100 ms | 127-454 ms |
| Tab transition worst frame | no frame > 33 ms | 67-317 ms (Log 317, Reminders 200) |
| Long tasks | none | 16, worst 365 ms |

At 1x all of these pass comfortably, so the cost is real but moderate. Where it likely comes from, in order of expected payoff:
1. The whole app ships as one 462 KB (143 KB gzip) bundle that includes Supabase and sqlite-wasm glue. Code-splitting Reports, the storage settings (Supabase client) and the gallery would cut cold start.
2. Each live row is a `motion.li` with layout projection; the first mount of a screen builds all of them.
3. Screen crossfade mounts the new screen while the old one is still in the tree (`popLayout`).

I haven't done these, because they need measuring on a real device first: the throttle is only an approximation, and a real mid-range phone may already pass or fail by a different margin.

## Other known gaps

- Sheet drag starts only from the header and grabber, not from the top of a scrolled body (S6.2).
- Shared-element zoom from a row to its detail isn't implemented (rows open sheets).
- `public/icon.svg` still has the old indigo; the maskable/PNG icon set is untouched.
- The service worker is still network-first, so a slow connection delays the shell instead of showing the cache immediately.
- Haptics exist only where the Vibration API does (Android).

---

## Re-run after the "Clean" redesign (components + screens)

Same verifier, same 5 configurations, production build.

| Check | Result |
|---|---|
| Contrast AA, every rendered text element, both themes, all screens and sheets | **Pass.** One miss was found and fixed ("Due soon" at 4.42:1); the token test now checks every status colour on its tint over every surface (75 tests) |
| Touch targets >= 44, labels, overflow at 320, clipping at 200% text | **Pass**, 0 findings |
| Layout shift | **Pass**, 0 |
| Touch-down feedback in the same frame | **Pass** |
| Scrolling | **Pass**, no frame over 33 ms (also at 4x) |
| Tab transitions, 1x | worst frame 50-83 ms in two runs (one tab, first visit), otherwise 17-33 ms. Slightly worse than before the redesign |
| Cold start, 1x | 0.53-0.90 s across runs (was 0.42 s). Run-to-run noise on this machine is large, so treat as a range |
| Tap to navigation, 1x | 62-115 ms on the first run, 88-204 ms on the second. **Borderline against the 100 ms target** |
| 4x CPU throttle | still **fails** cold start (1.5-2.9 s), navigation and tab transitions, as before |

What changed in this pass: flat rows with hairlines instead of grouped boxes, a compact one-row header instead of large titles, an underline switch, a two-column stat block on Home, a reminder progress line, Geist as the one typeface.

Known cost: self-hosted Geist adds ~67 KB (Latin + Latin-extended); the font swaps in after first paint. Preloading the Latin file and code-splitting Reports/Storage are the next performance levers.

Not yet done for the distinctiveness check: the "hide the logo" review on a real phone, and the progress line does not animate when a reminder moves between groups (the row remounts), only when its value changes in place.

---

## Performance pass (code-splitting, cached first paint, early start)

Measured with `scripts/verify-ui.mjs` on the production build, seeded data, real touch taps; tap-to-navigation is now timed **in the page** (pointer-down to the tab state changing), not by the harness. "4x" = CPU throttled 4x, a rough stand-in for a mid-range phone.

**What changed**
1. **First paint from a cached snapshot.** The last data read is kept in `localStorage` (on-device mode only, skipped above 1.5 MB) and shown on the very first frame; the real read replaces it a moment later. Covered by unit tests.
2. **Storage opens early.** `initDb()` is idempotent and starts from `main.tsx`, so the SQLite worker and WebAssembly load in parallel with the UI bundle, not after React mounts.
3. **Supabase loads only when it is the chosen storage** (about 104 KB, its own chunk). `db.ts` no longer builds a client at import time.
4. **Rarely used screens are separate chunks** (Reports, More and its sub-screens, Auth, Storage settings) and are prefetched when the browser is idle, so they are already there when tapped.
5. **`motion` split:** components use the lighter `m` + `LazyMotion`; the drag/layout/presence features (52 KB) load asynchronously beside the main bundle.
6. **Fonts preloaded** (Latin and Latin-extended Geist), so text paints in its final font; number formatters are created on first use.

| Metric (target) | Before | After, 1x | After, 4x |
|---|---|---|---|
| Initial JS, min / gzip | 463 KB / 143 KB | **294 KB / 96 KB** | same |
| Cold start to content (< 1 s) | 0.53-0.90 s | **0.22 s** | 1.0-1.45 s |
| First contentful paint / LCP (LCP < 2 s) | 0.76-0.96 s | **0.23 s** | 1.29 s |
| Tap to navigation (< 100 ms) | 62-204 ms (harness-limited) | **25-46 ms** | 87-457 ms |
| Worst tab-transition frame (no frame > 33 ms) | 50-83 ms | **17 ms** (zero dropped frames) | 67-500 ms |
| Layout shift (< 0.05) | 0 | **0** | 0 |
| Scrolling | 60 fps | **60 fps** | 60 fps (one 33 ms frame in one run) |
| Long tasks | 1-6 | **1** (53 ms) | 17 (worst 476 ms) |

Audit after the change: **no regressions**, 0 contrast / target-size / label / overflow / clipping findings across all five configurations, and **no page errors** in any run.

**Where the remaining 4x time goes** (CPU profile of the cold start, mapped through source maps): about 900 ms of the throttled cold start is JavaScript evaluation, roughly a third `motion`'s module code, a quarter `react-dom`'s first render, the rest our own code. There is no single hot spot left; further gains mean shipping less code up front, for example:
- render the first screen with plain CSS/React and bring `motion` in after first paint (largest remaining item, but it touches every animated component);
- precompute the token CSS at build time instead of generating it at startup (about 38 ms at 4x);
- a service-worker precache so a repeat visit skips the network for the shell.

**Status against Section 11:** passes on a recent device (everything above, "1x"). On the 4x stand-in it still misses cold start (1.0-1.45 s vs 1 s), navigation start (up to 457 ms on the first visit to a screen) and transition smoothness (first visit to Log). That throttle is an approximation; confirming on a real mid-range Android phone is still needed before calling it done.

---

## Performance pass, round 2: animation code off the first-paint path

The animation library (`motion`) is no longer in the first bundle. The first screen paints with plain elements; one chunk (`motionParts`, 82 KB / 29 KB gzip) holding every motion-driven part (screen transitions, sheets, toasts, context menus, swipe actions, live-list animation, completion moment, pull-to-refresh) loads once the browser is idle after first paint, or immediately when something needs it (opening a sheet, showing a toast). Components use `useMotionParts()` and render a plain fallback until it arrives. `Fade` and the tab-icon pop became CSS-only. The screen that is showing is never remounted: `ScreenTransition` switches to the animated implementation only on the next route change.

| Metric (target) | Before this pass | After, 1x | After, 4x |
|---|---|---|---|
| First-paint JS, min / gzip | 294 KB / 96 KB | **214 KB / 69 KB** | same |
| Cold start to content (< 1 s) | 0.22 s / 1.0-1.45 s (4x) | **0.24 s** | **0.94 s** |
| First contentful paint | 0.23 s / 1.29 s (4x) | **0.24 s** | **0.92 s** |
| LCP (< 2 s) | 0.23 s / 1.29 s (4x) | 0.32 s | 1.27 s |
| Tap to navigation (< 100 ms) | 25-46 ms / 87-457 ms (4x) | 26-75 ms | 98-292 ms |
| Worst tab-transition frame | 17 ms / 67-500 ms (4x) | 17 ms (50 ms on first visit to Log) | 83-267 ms |
| Layout shift | 0 | 0 | 0 |

Totals since the start of the performance work: first-paint JS **463 KB / 143 KB gzip -> 214 KB / 69 KB gzip**; 4x cold start **about 2.0 s -> 0.94 s**.

**Interaction smoke test** (`SMOKE=1 node scripts/verify-ui.mjs`, 20 checks, all pass): motion loads after first paint, sheet open/close/focus, header bell -> pushed Reminders -> back, tab crossfade (no slide), segmented bar movement, long-press menu (and it doesn't open the row), swipe-delete with Undo, short swipe springs back, swipe-to-done plays the completion moment, pull-to-refresh mounted, no page errors.

**Status against Section 11:** passes at normal speed. At the 4x stand-in, cold start and first paint now pass; tap-to-navigation (98-292 ms) and the worst transition frames (up to 267 ms on first visits) still miss. Remaining ideas: precompute the token CSS at build time, service-worker precache of the shell, and a lighter first mount of Home. Real-device confirmation is still needed.

## Information architecture change

Reminders moved from a tab to a header bell (with the overdue count) that opens Reminders as a pushed screen from any tab; Reports became a tab. Tab bar: Home, Log, Reports, More. Old `#reminders` and `#more/reports` links still resolve.
