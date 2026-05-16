# Local Postgres for development

`schema.prisma` is Postgres-only. You need a running Postgres instance reachable from `DATABASE_URL` in `.env`.

## Option 1 — Docker one-liner (fastest)

```bash
docker run -d \
  --name audgen-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=audgen \
  -p 5432:5432 \
  postgres:16
```

Then in `.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/audgen?schema=public"
```

Stop the container with `docker stop audgen-pg`, restart with `docker start audgen-pg`. The data persists in the container's anonymous volume until you `docker rm` it.

For a fresh slate:

```bash
docker rm -f audgen-pg
# then rerun the docker run command above
```

## Option 2 — Native Postgres

If you already have Postgres installed locally (Homebrew, apt, Postgres.app, etc.):

```bash
createuser -s audgen          # only the first time
createdb -O audgen audgen     # only the first time
```

```env
DATABASE_URL="postgresql://audgen@localhost:5432/audgen?schema=public"
```

## Sync the schema

```bash
npm run db:generate    # generate the Prisma client (postinstall already runs this)
npm run db:push        # apply the current schema to your DB
```

`db:push` is the right tool for local dev — it syncs the schema without writing migration history. In CI / staging / prod we use `db:migrate:deploy` once a real migration history exists (tracked in `AUTOPILOT_BACKLOG.md` / Approval Parking Lot).

## Seed demo data (optional)

```bash
npm run db:seed:demo       # adds a few demo leads + audits
npm run db:reset:demo      # removes them
```

## Don't have Postgres handy?

You can still run **lint / typecheck / test** without a live database. `src/lib/env.ts` uses zod to *parse* the env but only the prisma client *connects*. A placeholder URL is enough:

```env
DATABASE_URL="postgresql://x:x@localhost:5432/x?schema=public"
```

Then:

```bash
npm run check   # lint + typecheck + test
```

is fully runnable.

## Troubleshooting

- **`P1001: Can't reach database server`** — your Postgres isn't running, or the URL points somewhere else. `docker ps` to check.
- **`P1010: User <user> was denied access`** — wrong password / role. Recreate the role or fix `DATABASE_URL`.
- **Prisma migration drift after pulling new code** — run `npm run db:push` again. In dev this is non-destructive for additive changes; if you see a "data loss" warning, snapshot first.
