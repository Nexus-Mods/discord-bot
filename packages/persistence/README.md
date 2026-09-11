# @nexusmods/persistence

The data layer. The drizzle schema, the pg pool, the UPDATE builder, the token column
encryption, and the seven repositories that read and write rows.

## Wider than the plan's list

The plan named ten modules: `db/*`, `dbConnect`, `users`, `userRecord`, `subscriptions`
and two row types. Measuring changed it in both directions.

**In:** `servers`, `tips`, `news` and `server_role_conditions`. They are repositories over
the same pool and they were not on the list, and a package called "persistence" holding
seven of eleven repositories is a line nobody could remember the shape of.

**Out:** `api/users.ts`. It looks like a repository and is not one — every function returns
a `DiscordBotUser`, so it sits *above* the account model rather than in the data layer.
Cutting it here would have dragged `DiscordBotUser` in, and with it both OAuth clients and
`baseheader`. It stays in `apps/bot` with `DiscordBotUser`, which the plan already lists as
its own cut.

**Out:** `db/migrate.ts` and `db/backfillTokens.ts`. Both are process entry points on the
deploy path — `node dist/db/migrate.js`, and `npm run tokens:backfill` — and the Phase 4
plan leaves the deploy path alone until step 9. `drizzle/` and `drizzle.config.ts` stay
with them; the config points at the schema across the boundary rather than the migrations
moving away from the runner that applies them.

## discord.js, type-only

`Snowflake` is discord.js's alias for a string id and it annotates most row fields, so it
is a devDependency here. It never becomes a runtime import — that is one of the rules the
architecture tests enforce, and it is checked by path as well as by reachability.

One thing to fix before the admin area: `getServer` and `addServer` take a whole `Guild`
object and read `.name` off it. A web request has a guild id and no gateway object, so
that signature is the first thing the port will hit.
