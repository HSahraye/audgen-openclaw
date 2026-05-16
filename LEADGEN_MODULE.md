# LeadGen Command Center

## What this module is

`/leadgen` is the phase-1 top-of-funnel module for AudGen. It helps operators discover, qualify, and route local business opportunities into the existing AudGen sales engine without calling live external APIs.

## Route

- ` /leadgen`

## Files added/changed

### New files

- `src/app/leadgen/page.tsx`
- `src/app/leadgen/loading.tsx`
- `src/components/leadgen-command-center.tsx`
- `src/app/actions/leadgen.ts`
- `src/lib/leadgen/types.ts`
- `src/lib/leadgen/scoring.ts`
- `src/lib/leadgen/filters.ts`
- `src/lib/leadgen/export.ts`
- `src/lib/leadgen/mock-data.ts`
- `src/lib/leadgen/sources.ts`
- `src/lib/leadgen/index.ts`
- `src/lib/leadgen/ui-state.ts`
- `src/lib/leadgen/scoring.test.ts`
- `src/lib/leadgen/filters.test.ts`
- `src/lib/leadgen/export.test.ts`
- `src/lib/leadgen/sources.test.ts`
- `src/lib/leadgen/ui-state.test.ts`

### Updated files

- `src/components/audit-dashboard.tsx` (adds LeadGen nav entry)
- `src/lib/env.ts` (adds optional Google Sheets env placeholders)
- `.env.example` (documents LeadGen connector env vars)

## Scoring model

Scoring is deterministic and pure (`src/lib/leadgen/scoring.ts`):

- Produces `estimatedNeedScore` between 0 and 100.
- Maps score to `Low | Medium | High | Critical`.
- Prioritizes:
  - Missing website
  - Weak website quality
  - Missing GBP signal
  - Missing booking/contact/social flows
  - Low reviews and weak ratings
  - Slow response signal
  - High-value local-service categories
- Produces explainable outputs:
  - `presenceGaps[]`
  - `recommendedOffer`
  - `suggestedPitch`
  - `estimatedRevenuePotential`

## Export behavior

`src/lib/leadgen/export.ts` provides:

- Standard CSV export with stable headers.
- Google-Sheets-ready CSV export with same stable order.
- Safe quoting/escaping through existing shared CSV utilities.
- Presence gaps serialized as semicolon-separated values.

No Google API call is made in this phase.

## Mock/local-only scope

Current phase intentionally uses:

- Mock/local lead source adapter.
- Manual CSV import and local scoring.
- Disabled Google Places and Google Sheets adapters.
- Disabled future connector placeholders.

No scraping, no paid API calls, and no outbound automations are triggered.

## Add to AudGen integration

`addSelectedLeadgenToAudgenAction` adds selected opportunities into `ResearchQueueItem` safely:

- De-dupes against existing leads and queue items by business/location or website.
- Stores source as `leadgen:*`.
- Adds presence-gap notes for downstream context.
- Revalidates `/research` and `/leadgen`.

This allows sales ops to move qualified opportunities into the existing AudGen queue before audit generation.

## Future connectors and approval gates

The architecture supports future adapters, but they are intentionally disabled until approved:

- `google_sheets`
- `google_places`
- `future_connector`

### Env placeholders (documented only)

```
GOOGLE_SHEETS_CLIENT_EMAIL=
GOOGLE_SHEETS_PRIVATE_KEY=
GOOGLE_SHEETS_SPREADSHEET_ID=
```

## Approval required before live activation

Before enabling live connectors, explicit approval is required for:

- Real Google Places API usage
- Real Google Sheets API usage
- Any paid model/API calls
- Any scraping or outbound automation

## Suggested next steps

1. Add server-side persistence for LeadOpportunity snapshots.
2. Add explicit batch status workflow (`reviewed/exported/queued`) tracking.
3. Add role-scoped audit generation from LeadGen selection.
4. Add connector health checks + environment diagnostics in UI.
5. Add E2E route tests once browser test harness is added.
