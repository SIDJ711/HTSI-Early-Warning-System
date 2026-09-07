---
name: Open-Meteo local timestamps
description: Open-Meteo auto-timezone forecast timestamps are local wall-clock strings without an offset.
---

Treat timestamps returned by Open-Meteo with `timezone=auto` as local wall-clock values, not UTC instants, unless the provider response includes an explicit offset.

**Why:** Native JavaScript date parsing shifts offset-less strings into the browser timezone and can move the displayed forecast by several hours.

**How to apply:** Preserve the provider's timezone and format offset-less `YYYY-MM-DDTHH:mm` values directly for charts, peak windows, and last-updated labels.