# Migration plan — promote `Lead.status` to a proper enum

Status: **proposed, not executed**. Do not run any of this without explicit
approval and a fresh database backup.

## Why

`Lead.status` is currently a free-text `String @default("New")`. The
application-layer canonical `LeadStage` enum lives in `src/lib/pipeline/stages.ts`
and a normalizer maps legacy values onto it. Until we promote the column
to a real Prisma enum, two risks remain:

1. New free-text values can land in the table by accident (a missed code
   path, a manual SQL update, an old client) and quietly classify as
   `NEW` via the normalizer.
2. Database-level constraints can't help us \u2014 every aggregation has to
   normalise in-app.

## What we change

Schema:
```prisma
enum LeadStage {
  NEW
  IMPORTED
  SCORED
  AUDIT_GENERATED
  PREPARED
  CONTACTED
  REPLIED
  QUALIFIED
  CALL_BOOKED
  PROPOSAL_SENT
  WON
  LOST
  NURTURE
  DISQUALIFIED
}

model Lead {
  // \u2026
  stage LeadStage @default(NEW)
  // status String @default("New")  // keep for one release as a fallback, then drop
}
```

Keep `status` for one release alongside `stage` so we can roll back. After
one full release window confirms `stage` is populated correctly, drop
`status`.

## Migration steps (in order)

1. **Backup the database.** `pg_dump` to a known-good snapshot. Verify
   the snapshot restores into a staging DB. No migration begins until
   this is signed off.
2. **Add the enum + column as nullable.** Prisma migration that adds
   `Lead.stage` as a nullable `LeadStage?`. No code reads it yet.
3. **Backfill** in a single transaction:
   ```sql
   UPDATE "Lead" SET "stage" = CASE
     WHEN UPPER(REPLACE(status, ' ', '_')) IN (
       'NEW','IMPORTED','SCORED','AUDIT_GENERATED','PREPARED','CONTACTED',
       'REPLIED','QUALIFIED','CALL_BOOKED','PROPOSAL_SENT','WON','LOST',
       'NURTURE','DISQUALIFIED'
     ) THEN UPPER(REPLACE(status, ' ', '_'))::"LeadStage"
     WHEN UPPER(status) IN ('AUDITED','AUDIT','AUDIT_DONE') THEN 'AUDIT_GENERATED'::"LeadStage"
     WHEN UPPER(status) IN ('PREP','PREP_READY','PREPPED') THEN 'PREPARED'::"LeadStage"
     WHEN UPPER(status) IN ('OUTREACHED','EMAILED','CALLED') THEN 'CONTACTED'::"LeadStage"
     WHEN UPPER(status) IN ('RESPONDED') THEN 'REPLIED'::"LeadStage"
     WHEN UPPER(status) IN ('DEMO_BOOKED','MEETING_BOOKED','BOOKED') THEN 'CALL_BOOKED'::"LeadStage"
     WHEN UPPER(status) IN ('PROPOSAL','QUOTED') THEN 'PROPOSAL_SENT'::"LeadStage"
     WHEN UPPER(status) IN ('CLOSED_WON','PAID') THEN 'WON'::"LeadStage"
     WHEN UPPER(status) IN ('CLOSED_LOST') THEN 'LOST'::"LeadStage"
     WHEN UPPER(status) IN ('SNOOZE') THEN 'NURTURE'::"LeadStage"
     WHEN UPPER(status) IN ('DQ','UNQUALIFIED') THEN 'DISQUALIFIED'::"LeadStage"
     ELSE 'NEW'::"LeadStage"
   END
   WHERE "stage" IS NULL;
   ```
   (Aligned with `normalizeStage()` in `src/lib/pipeline/stages.ts`.)
4. **Promote to NOT NULL.** Add `NOT NULL` + `DEFAULT 'NEW'`.
5. **Cut application reads to `stage`** in a follow-up release; keep
   writes going to both `status` and `stage` during the transition window.
6. **Cut application writes to `stage` only.**
7. **Drop `status`** after one full release with no fallbacks needed.

## Rollback

At any step before (7), drop the new column and revert the Prisma client:
```sql
ALTER TABLE "Lead" DROP COLUMN "stage";
DROP TYPE "LeadStage";
```
Application keeps reading/writing `status` as before. No data loss.

## Approval checklist

- [ ] Hamid approves the timing.
- [ ] DB backup taken and restore-tested.
- [ ] Staging migration completes without errors.
- [ ] Application code paths reading `Lead.status` are inventoried and
      scheduled for the dual-write window.
- [ ] Monitoring dashboards continue to render after the column add.

Until every box is ticked, the application-layer enum + normalizer remains
the source of truth. This is the safe state we are in today.
