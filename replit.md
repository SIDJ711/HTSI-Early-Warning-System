# HTSI Early Warning System

Live heat-risk monitoring dashboard that turns Open-Meteo observations into a transparent prototype Human Thermal Stress Index and forecast-based warning signal.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/htsi-early-warning/src/pages/dashboard.tsx` — responsive live monitoring dashboard
- `artifacts/htsi-early-warning/src/index.css` — light/dark theme tokens and dashboard styling
- `artifacts/api-server/src/services/openMeteoService.ts` — Open-Meteo fetch, normalization, and forecast warning logic
- `artifacts/api-server/src/htsi/` — centralized prototype HTSI model configuration and calculator
- `lib/api-spec/openapi.yaml` — source of truth for weather API contracts

## Architecture decisions

- Weather data is fetched server-side from Open-Meteo and returned through normalized `/api/weather/current` and `/api/weather/forecast` endpoints.
- The prototype HTSI model is rule-based and centralized so its thresholds and weights can be replaced by an ML provider later without changing the UI contract.
- The browser uses geolocation on first load, with an Indian city selector as the explicit fallback; no weather values are silently mocked.
- The location panel uses Leaflet with OpenStreetMap tiles and displays the same live HTSI snapshot in the marker popup.

## Product

- Live current temperature, humidity, wind, pressure, solar radiation, cloud cover, and weather condition.
- Calculated HTSI gauge, readable risk level, 24-hour forecast chart, peak period, early warning, and prototype heatwave risk.
- Open-Meteo/source transparency, last-updated timestamp, light/dark themes, responsive mobile navigation, and error/retry handling.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run OpenAPI codegen after changing `lib/api-spec/openapi.yaml`; the frontend imports the generated hooks from `@workspace/api-client-react`.
- Open-Meteo timestamps returned with `timezone=auto` are local wall-clock strings without an offset; the dashboard formats them directly instead of letting `Date` reinterpret them as UTC.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
