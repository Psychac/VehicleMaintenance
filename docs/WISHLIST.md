# Feature Wishlist

Ideas not yet scheduled. Add new items below with a short rationale.

## Settings: Imperial / Metric unit system

**Idea:** A setting in the Settings screen (More tab) to switch between metric and imperial units.

**Scope**
- Distance / odometer: km <-> mi
- Fuel volume: litres <-> gallons (US/UK variant to be decided)
- Fuel economy: L/100km or km/L <-> MPG
- Cost per distance / per volume: currency/km <-> currency/mi, currency/L <-> currency/gal
- Tyre pressure: kPa/bar <-> psi (if tracked)

**Notes**
- Store values internally in one canonical unit (metric) and convert only at display/input time, so toggling never rewrites data.
- Persist the preference in the existing settings storage; default from device locale (US/UK/Myanmar/Liberia -> imperial, otherwise metric).
- Reports, charts, reminders (e.g. "every 5,000 km") and CSV export need to respect the setting; decide whether exports always use metric.
- Reminder intervals entered in one unit should survive a switch (convert, round sensibly).
- Needs a single formatting helper (e.g. `formatDistance`, `formatVolume`, `formatEconomy`) used by all screens.
