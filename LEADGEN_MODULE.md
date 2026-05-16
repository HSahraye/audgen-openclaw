# LeadGen Command Center

## Module mission

`/leadgen` is the top-of-funnel command center in AudGen:

Find Leads → Qualify → Export/Add to AudGen → Generate Audit → Outreach → Revenue.

Phase 2 keeps this flow safe/local-first with approval-gated connectors and audit generation.

## Route

- `/leadgen`

## Phase 2 architecture

### Server-side persistence design (workspace scoped)

To avoid risky/destructive DB work, Phase 2 reuses existing workspace-scoped models:

- `ResearchQueueItem` as persisted LeadGen opportunity record
- `FeatureFlag` as saved filter view storage (`leadgen.saved_view.*`)
- `Activity` as LeadGen timeline storage (`type` prefixed with `leadgen.` and `metadataJson` linking `opportunityId`)

LeadGen opportunities are stored with:

- core business fields in `ResearchQueueItem` columns
- expanded LeadGen fields (scores, gaps, diagnostics fields, offer/pitch, etc.) serialized in `notes` as prefixed JSON metadata
- strict workspace scoping through existing workspace helpers

This gives server persistence now without schema resets/destructive operations.

### Saved filter views

Saved view support includes:

- preset views:
  - Missing Website
  - High Opportunity
  - Ready for Audit
  - Exported
  - Queued
  - Local Contractors
  - Low Reviews
  - No GBP Signal
- custom per-workspace saved views in `FeatureFlag.metadataJson`
- apply/delete support in UI

### Bulk status workflow

Workflow statuses:

- `discovered`
- `reviewed`
- `exported`
- `queued`
- `audit_generated`
- `contacted`
- `follow_up`
- `won`
- `lost`
- `archived`

Bulk action bar supports:

- mark reviewed
- mark queued
- mark archived
- reset discovered
- export + mark exported

### Activity log design

Each opportunity shows timeline events sourced from `Activity`:

- discovered
- score_calculated
- exported_csv
- added_to_audgen_queue
- status_changed
- audit_generation_requested
- audit_generation_requires_approval
- note_added

### Audit generation preflight design

`Generate Audit for selected` is intentionally approval-gated:

- runs preflight only (selected count, batch limit, entitlement remaining, estimate)
- does **not** trigger live paid generation
- queues selected opportunities for approval flow (`queued` status + activity events)
- uses existing entitlement helper (`enforceAuditGeneration`) for safe checks

### Connector diagnostics

Connector diagnostics card reports:

- status (`ready` / `mock` / `disabled` / `missing_env` / `requires_approval`)
- required env vars
- external API usage flag
- safe-now boolean
- last checked time
- safety note

Connectors shown:

- Mock Local Leads
- Manual CSV Import
- Google Sheets Export
- Google Sheets Import
- Google Places
- Website/Domain List
- Future Scraper Connector

### E2E/integration coverage

No Playwright/Cypress framework is currently installed in this repo.

Phase 2 adds lightweight integration-style coverage through pure interaction utilities and tests:

- selection behavior
- select all visible behavior
- import merge behavior
- export enablement behavior

## Tests added in Phase 2

- `src/lib/leadgen/persistence.test.ts`
- `src/lib/leadgen/diagnostics.test.ts`
- `src/lib/leadgen/audit-preflight.test.ts`
- `src/lib/leadgen/ui-interactions.test.ts`

Existing leadgen tests were updated for new workflow statuses and expanded logic.

## Env placeholders

Documented placeholders (values are never printed):

```
GOOGLE_SHEETS_CLIENT_EMAIL=
GOOGLE_SHEETS_PRIVATE_KEY=
GOOGLE_SHEETS_SPREADSHEET_ID=
GOOGLE_PLACES_API_KEY=
```

## What remains mock/local-only

- No live Google Sheets API call
- No live Google Places API call
- No scraping connector
- No outbound messaging trigger
- No paid audit generation triggered from LeadGen

## Approval parking lot (Hamid approval required)

1. Enabling real Google Sheets import/export API calls.
2. Enabling real Google Places discovery API calls.
3. Enabling any scraping connector.
4. Enabling live paid audit generation execution from LeadGen queue.
5. Optional dedicated LeadGen Prisma models/migrations (if moving away from reused `ResearchQueueItem`/`FeatureFlag`/`Activity` storage).

## QA hardening notes

- Added explicit `id`/`name` attributes across LeadGen form controls to address browser form-field warnings.
- Improved table scanability with fixed column widths, clearer status/opportunity badges, and consistent row highlight styling.
- Improved mobile/laptop behavior with cleaner section spacing and horizontal table overflow handling.
- Added helpful disabled-state messaging for selection-based actions.
- Added explicit empty states for:
  - no persisted opportunities
  - no filter matches
- Added helper action for loading sample opportunities safely when workspace has no LeadGen records.

## Console/CSP observation

- The CSP warning seen in deploy-preview screenshots references `https://app.netlify.com` in `frame-src`.
- This is preview-toolbar/Netlify overlay behavior, not required app functionality.
- No CSP broadening was applied.

## Brand naming follow-up

Brand naming remains pending Hamid decision across:

- AudGen
- AuditGen
- SaleGen
- Presence Labs
