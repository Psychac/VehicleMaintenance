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
