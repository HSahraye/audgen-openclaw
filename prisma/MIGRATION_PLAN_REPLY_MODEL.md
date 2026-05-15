# Migration plan — promote replies to a first-class `Reply` model

Status: **proposed, not executed**. Do not run without approval and a DB backup.

## Why

Manual reply logging today writes to two existing tables:
- `OutreachLog` with `type="reply"` and the reply body in `notes`.
- `Activity` with `type=REPLY_LOGGED` and structured `metadataJson` holding
  the classification, previousStage, nextStage, stageChanged, actorUserId.

That works without a schema change, but it has three weaknesses:
1. **Schema drift.** Two tables describe one event; future analytics queries
   have to JOIN and reconstruct.
2. **No first-class classification column.** `metadataJson` strings cannot be
   indexed or filtered efficiently.
3. **No clean place** to attach later fields: thread id, provider-message-id,
   sentiment score, embedding vector, "needs human review" flag.

Once the manual flow is being used in production, we promote replies to a
real model:

```prisma
enum ReplyClassification {
  INTERESTED
  NOT_INTERESTED
  WRONG_CONTACT
  FOLLOW_UP_LATER
  PRICING_OBJECTION
  ALREADY_HAS_PROVIDER
  BOUNCED
  ANGRY
  BOOKED_CALL
  NEEDS_MORE_INFO
}

model Reply {
  id              String              @id @default(cuid())
  workspaceId     String
  leadId          String
  classification  ReplyClassification
  body            String?
  channel         String?  // "email" | "sms" | "phone" | "in_person" | "manual"
  providerMessageId String?
  threadId        String?
  loggedByUserId  String?
  createdAt       DateTime            @default(now())
  workspace       Workspace           @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  lead            Lead                @relation(fields: [leadId],      references: [id], onDelete: Cascade)
  @@index([workspaceId, createdAt])
  @@index([leadId, createdAt])
  @@index([classification])
}
```

## Migration steps (in order)

1. **Backup the DB.** `pg_dump` + restore-test in staging.
2. **Add `Reply` table.** Pure additive migration — zero risk to existing
   data.
3. **Backfill** by reading `OutreachLog where type='reply'` and joining the
   matching `Activity where type='REPLY_LOGGED'` row to recover the
   classification:
   ```sql
   INSERT INTO "Reply" (id, "workspaceId", "leadId", classification, body, "loggedByUserId", "createdAt")
   SELECT
     gen_random_uuid()::text,
     o."workspaceId",
     o."leadId",
     (a."metadataJson"::jsonb ->> 'classification')::"ReplyClassification",
     o.notes,
     (a."metadataJson"::jsonb ->> 'actorUserId'),
     o."createdAt"
   FROM "OutreachLog" o
   JOIN "Activity" a
     ON a."leadId" = o."leadId"
    AND a."workspaceId" = o."workspaceId"
    AND a.type = 'REPLY_LOGGED'
    AND a."createdAt" BETWEEN o."createdAt" - INTERVAL '5 seconds' AND o."createdAt" + INTERVAL '5 seconds'
   WHERE o.type = 'reply'
     AND NOT EXISTS (
       SELECT 1 FROM "Reply" r
       WHERE r."leadId" = o."leadId"
         AND r."createdAt" = o."createdAt"
     );
   ```
4. **Switch `logManualReply` to dual-write** (Reply + Activity for one
   release window). Reads can already prefer Reply if present.
5. **Cut reads to `Reply`.**
6. **Stop writing the OutreachLog `type='reply'` row.** Keep historical
   rows; new replies live only in `Reply`.

## Rollback

Drop the `Reply` table and the `ReplyClassification` enum:
```sql
DROP TABLE "Reply";
DROP TYPE "ReplyClassification";
```
Application keeps reading the OutreachLog + Activity pair. No data loss
because dual-write was on through the cutover.

## Approval checklist

- [ ] Hamid approves the timing.
- [ ] DB backup taken and restore-tested.
- [ ] Staging migration completes without errors.
- [ ] Reads still serve correct counts when the new table is empty.
- [ ] Monitoring dashboards continue to render after the column add.

Until every box is ticked, manual reply logging continues to write to
OutreachLog + Activity, and the application-layer enum + helper remain
the source of truth.
