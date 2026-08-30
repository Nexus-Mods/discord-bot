# Deploying

## 4.2.0 - The auth site is its own container

**This is a topology change, not a code change.** The OAuth portal, the tracking pages,
the forum webhook and the `/automod` endpoints no longer run inside the bot process.
They are a second container, from the same image, started with a different command.

| | Command | Serves |
|---|---|---|
| Bot | `node dist/shards.js` (image default) | Discord gateway, commands, feeds. **No HTTP at all now.** |
| Web | `node dist/web.js` | Everything that was on `AUTH_PORT` |

### What has to change on the droplet

1. **Add the second service.** `docker-compose.yml` in this repository shows the shape;
   the production file needs the same two services from the same image tag.
2. **Move the port mapping.** Whatever publishes the site today is attached to the bot
   container. It has to point at `web` instead - the bot container no longer listens on
   anything, so leaving the mapping where it is means the site returns nothing.
3. **Give the web container the environment.** Simplest and least error-prone is the same
   env file both containers already share. It needs, at minimum:

   `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`,
   `NEXUS_OAUTH_ID`, `NEXUS_OAUTH_SECRET`, `NEXUS_REDIRECT_URI`, `COOKIE_SECRET`,
   `UNLINK_SECRET`, `SITE_BASE_URL`, `AUTH_PORT`, `TRUST_PROXY`, the `HOST`/`DATABASE`/
   `DBUSER`/`DBPASS`/`DBPORT` group, `AUTOMOD_DATABASE`, `AUTOMOD_AUTHCODE`,
   `ADMIN_AUTHCODE`, `FORUM_API_KEY` and `DISCORD_SUGGESTION_WEBHOOKS`.

   `DISCORD_TOKEN` is needed even though this process never connects to the gateway: the
   tracking page resolves guild and channel names over REST with it. The site refuses to
   start without it rather than rendering a broken page.

4. **Keep it to one replica.** In-flight OAuth state lives in an in-memory `Map`, so a
   second replica would answer the Nexus Mods callback for a link the other replica
   started and reject it as unknown state. Moving that to the database is what a second
   replica needs; nothing else does.

### One migration: an orphaned sequence

`0002_drop_orphan_sequence` removes `mod_feeds__id_seq`. The `mod_feeds` table was
dropped at some point before this work began and its sequence was left behind; the
production schema dump confirms it — a `CREATE SEQUENCE` with no `OWNED BY` and no table
of that name anywhere in the file.

**It cannot break an insert.** The migration does not `DROP ... CASCADE`, which would
silently strip a column default if the assumption were wrong. It attempts a bare `DROP
SEQUENCE`, which Postgres refuses with `dependent_objects_still_exist` if anything still
needs the sequence, and catches that — so the sequence is dropped only if the database
agrees it is unused, and is left in place with a notice otherwise. Verified against a
real PostgreSQL 16 in three states: orphaned (dropped), still backing a `serial` column
(left alone, inserts still work), and absent (no-op).

Two notes. Production is PostgreSQL **17** and this was verified on 16; the dependency
behaviour of `DROP SEQUENCE` is not version-specific, but the check has not run on 17.
And there is nothing to roll back — a sequence that no table references holds no data.
Rolling the image back leaves the database in a state the previous version is happy with.

### The connection ceiling dropped from 10 to 4

Per pool, per process. Three shards hold one pool each and the web process holds two, so
the default is now a ceiling of 20 rather than 50 against a database that allows 22
backend connections. Production has been safe only because it connects through PgBouncer,
which nothing in the code requires.

`DB_POOL_MAX` overrides it. Nothing needs to be set for this deploy; raise it only if
pool acquisition starts to queue, and count the pools first. The resolved value is logged
at debug on first use.

### The bot only runs sharded now

`dist/app.js` is the shard child and refuses to start on its own; `npm start` and the
image default are both `dist/shards.js`, which is what production already runs. Nothing
changes in a container that was already using the image default.

The unsharded path existed for local development, and it meant local runs exercised
`if (!client.shard)` branches production never takes. `BOT_SHARD_COUNT` forces a shard
count when one is wanted - `BOT_SHARD_COUNT=1` is the supported way to run a single
gateway connection, and `client.shard` is still populated, so it is the same code path.
Left unset, the count is still `auto`.

### What does not change

- **Tables and columns are untouched.** The one migration in this release drops a stray sequence and nothing else — see below.
- **Both containers migrate on start.** `runMigrations` takes a Postgres advisory lock,
  so whichever starts first does the work and the other waits and finds nothing to do.
  This is deliberate: it removes any ordering requirement between the two services.
- **One image, one tag.** Both containers run the same build, so they cannot drift to
  different code against the same database. Rollback is still the previous tag - applied
  to both services.
- **Routes, cookies and URLs are unchanged.** `SITE_BASE_URL` and both OAuth redirect
  URIs stay exactly as they are; nothing needs updating in the Discord or Nexus Mods
  developer consoles.

### What to watch

- **The site answers at all.** `GET /` on the public URL. If it does not, the port
  mapping is still on the bot container.
- **A full link flow.** `/linked-role` through to `/success`. This is the path that used
  the in-process client's session, and the one that would notice if `TRUST_PROXY` or the
  cookie settings arrived differently in the new container.
- **`/tracking?guild=<id>`.** Guild name, icon and channel names now come from REST
  rather than discord.js's cache. An unknown guild id redirects to `/` - previously it
  produced a 500, because `guilds.fetch()` threw rather than returning nothing.
- **Bot memory.** Should fall slightly: shard 0 was carrying express, ejs and the view
  cache for no reason on the other two.

### Rollback

Previous image tag on the bot service, port mapping back where it was, web service
removed. The database is untouched by this release, so nothing has to be undone there.

---

## 4.1.0 - Phase 3.5, the query error contract

**One behaviour change, and it is in the feeds.** Query modules that used to return `[]`
on failure now throw, so a failed poll is no longer indistinguishable from a poll that
found nothing.

| Change | What it means for a deploy |
|---|---|
| A failed Nexus API call propagates | Previously it returned `[]`. For a feed that read as "nothing new", the cycle was recorded as successful and `last_update` advanced - so anything published during an outage was skipped permanently and silently. |
| Feed cycles no longer advance the window on failure | The next poll covers the same period again. **Expect the occasional repeated post after a Nexus API blip** - that is the intended trade, and the opposite failure (a silent gap) is the one being removed. |
| Interactive commands say the API is unreachable | Rather than "no results found". |
| `/search games` fails instead of returning nothing | The games list is the thing being searched, so `[]` was a lie when the API was down. |

**What to watch after deploying:** feed volume for a few cycles. A short burst of repeats
after an upstream hiccup is correct. Sustained duplicates are not - check the logs for
`Skipping channel timestamp update, some subscriptions failed`, which names how many
items failed and in which channel.

Nothing here needs configuration. No migration runs.

---

## 4.0.0 - Phase 1, foundations

Toolchain and internals only. **No behaviour changes to any command, feed or
endpoint**, and no new configuration is required beyond what 3.17.0 introduced.

| Change | What it means for a deploy |
|---|---|
| Build is tsup, not tsc | `npm run build` drops from ~15s to ~1.2s. `clean.cjs`, `add-js-extensions.cjs` and `build.sh` are deleted. Output layout is unchanged, so nothing downstream moves. |
| Dockerfile is multi-stage on node 22 | Smaller runtime image, runs as `node` rather than root, dev dependencies pruned. **`CMD` is now exec form**, so the container receives SIGTERM directly - `docker stop` no longer waits out its timeout and SIGKILLs the bot mid-poll. |
| Logging is pino | JSON on stdout in production, pretty in development. **If anything parses the bot's logs, it needs updating** - the format has changed from coloured text to structured JSON. `LOG_LEVEL` replaces `DEBUG_LOGGING`. |
| OAuth tokens are redacted in logs | Anything under a credential-shaped key is replaced with `[redacted]`. |
| Errors carry causes and user-facing messages | Users now see a generic message plus a short reference id rather than a raw error string. **The full error is logged against that id**, so support requests should quote it. |
| CI gates on typecheck, lint and tests | Nothing is published unless all three pass. Images are tagged with the version and the commit sha as well as `latest`. |
| Node 22 required | `engines` now declares `>=22`. The Docker image already uses it. |

`npm ci` is needed for the new dependencies (pino, tsup, vitest) and for the
removal of jsonwebtoken, path and copyfiles.

### Phase 3, database migrations

The schema is now in the repository and applied by drizzle on startup. This is
the one part of 4.0.0 that touches the live database, so read it before deploying.

| Change | What it means for a deploy |
|---|---|
| `drizzle/0000_baseline.sql` describes the schema as it exists today | On the first 4.0.0 start it is recorded as applied. It uses `CREATE TABLE IF NOT EXISTS` and guards its one foreign key, so **it does not modify the existing schema** - verified by applying it to a copy of a production dump and diffing before and after. |
| Migrations run before any shard spawns | A migration failure now **stops the bot from starting** (exit 1) instead of being logged and ignored. This is deliberate: running against an unexpected schema produces confusing per-command failures and some of them write bad data. |
| A Postgres advisory lock wraps the run | Safe when the sharding manager, its shards, or a second container start at once. |
| `api/migrations.ts` is gone | Its two functions were gated on `npm_package_version === '3.13.0'`/`'3.13.1'` and had not run in a long time. Neither is still needed - both were verified applied in production. |
| Lazy `CREATE TABLE IF NOT EXISTS` calls are gone | `ensureNewsDB` and `ensureSubscriptionsDB` no longer run on feed startup. |
| `npm run db:migrate` | Runs migrations without starting the bot, for running them by hand or from CI. |

**Before the first 4.0.0 start:** take a schema dump. The baseline should be a
no-op, but it is the first release that runs DDL at startup and a dump costs
nothing.

**After the first start**, confirm the baseline was recorded rather than replayed:

```sql
SELECT * FROM drizzle.__drizzle_migrations;   -- expect exactly one row
```

**One known piece of drift**, not touched by this release: production has a
sequence `mod_feeds__id_seq` owned by no table, left behind when `mod_feeds` was
dropped. It is harmless. `DROP SEQUENCE public.mod_feeds__id_seq;` clears it
whenever convenient; until then `drizzle-kit push` will keep offering to drop it.
(Use `db:generate` and `db:migrate`, not `push` - `push` skips the migration
history.)

Three orphaned tables are in the same category and *are* modelled in
`src/db/schema.ts` so that drizzle does not propose dropping them: `game_feeds`,
`user_mods` and `user_servers`. No code reads any of them.

### Before the first 4.0.0 start

This release is large, and none of it has run against a live gateway or database. Work
through this list rather than reading it.

| Check | Why | If it's wrong |
|---|---|---|
| Take a schema dump | First release that runs DDL at startup | &mdash; |
| `AUTOMOD_DATABASE` is set in the container's environment | The automod pool now refuses to be built without it, instead of silently connecting to a database named after the user | `/automod` endpoints return errors on first use |
| `WATCHED_CHANNEL_ID` is set in the container's environment | It now gates the `GuildMessages` intent, not just the handler | The anti-spam bait channel silently stops working |
| `DB_SSL` is unset, or set to `on` | Unset reproduces the old behaviour exactly (TLS on when `NODE_ENV` is `production` or absent) | Set it to `on` explicitly if `NODE_ENV` is something else in production |
| Note the current image tag | CI tags by version and commit sha, so rollback is running the previous tag | &mdash; |

Note that `.dockerignore` excludes `*.env`, so configuration is injected at run time rather
than baked into the image. Whatever mechanism does that needs to carry the two variables
above; the compose file in this repository is a local development setup and is not what
production uses.

### After the first start

```sql
SELECT * FROM drizzle.__drizzle_migrations;   -- expect exactly one row
```

Then watch two graphs for the first hour:

- **Memory should fall.** discord.js was holding 200 messages per channel across every
  channel in every guild, swept hourly, while nothing read that cache. It is capped at
  zero now. On a box running at 80% this is the change most likely to be visible.
- **CPU should fall somewhat, not dramatically.** Four unused intents are gone, but
  `GuildMessages` stays while the bait channel is live, and that is the dominant event
  stream. Getting the rest of it means moving that feature into its own process &mdash;
  see MODERNISATION.md 5.3.

If either graph moves the wrong way, the previous image tag is the rollback. Migrations
are forward-only, but 0000 is the baseline and creates nothing that 3.17.0 did not have,
so rolling the image back does not require rolling the database back.

Nothing else in this document changes for 4.0.0; the 3.17.0 notes below still
describe the configuration this release runs on.

---

## 3.17.0 - Phase 0, hardening

Release 3.17.0 closes three unauthenticated endpoints, fixes 21 correctness
defects, and removes the community map and the automod feed.

**It is not a drop-in deploy.** Three of the changes need configuration or
coordination before the release goes out. Work through this list first.

---

## 1. New environment variables

The auth site now refuses to start without two secrets, and warns about the
optional ones. `.env.example` is the full reference; the placeholders are also
commented at the bottom of `.env`.

| Variable | Required | What it does |
|---|---|---|
| `COOKIE_SECRET` | **Yes** | Signs the OAuth state cookie. Any long random string. |
| `UNLINK_SECRET` | **Yes** | Signs the `/revoke` unlink links the bot posts in Discord. Any long random string. |
| `ADMIN_AUTHCODE` | Recommended | Guards `GET /show-metadata` and `POST /update-metadata`. |
| `AUTOMOD_AUTHCODE` | **See §2** | Guards the `/automod` CRUD endpoint. |
| `SITE_BASE_URL` | Optional | Origin used to build the links the bot posts. Defaults to `https://discordbot.nexusmods.com`. |
| `TRUST_PROXY` | Optional | Number of reverse proxies in front of the app, so rate limiting sees real client IPs. |
| `DEBUG_LOGGING` | Optional | Set to `true` to keep debug logging on when `NODE_ENV=production`. |

Generate the two required secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

**If `COOKIE_SECRET` or `UNLINK_SECRET` is missing**, `AuthSite.initialize()`
throws. `app.ts` catches it, so the bot still connects to Discord and slash
commands keep working — but the website will not come up and account linking
will be unavailable. Check the startup logs for
`Failed to set up Auth website`.

---

## 2. `/automod` now fails closed — coordinate with the external automod app

Previously `checkPermission()` returned `true` when the `Authorization` header
did **not** match, and passed everything when no secret was configured. So the
endpoint was effectively open. It now:

- requires `AUTOMOD_AUTHCODE` to be set, and
- requires an exact `Authorization: <AUTOMOD_AUTHCODE>` header on every request.

**Before deploying**, set `AUTOMOD_AUTHCODE` in the bot's environment and
configure the external automod app to send the same value. If the app is
deployed without it, rule reads and writes will start returning `401`.

The same applies to `ADMIN_AUTHCODE` if anything automated calls
`/show-metadata` or `/update-metadata`.

---

## 3. The unlink flow changed shape

`GET /revoke?id=<discordId>` used to delete an account link outright, from a
public Discord ID, with no ownership check — triggerable by an `<img>` tag or a
link unfurl.

Now:

1. The bot signs the unlink URL with `UNLINK_SECRET` (HMAC over the Discord ID,
   24 hour expiry) when it renders the `/link` and `/unlink` buttons.
2. `GET /revoke` verifies the signature and renders a confirmation page.
3. `POST /revoke` performs the deletion.

**Consequences:**

- Unlink buttons in **messages older than 24 hours will have expired.** Users
  see "This unlink link is invalid or has expired. Run /unlink in Discord to get
  a new one." This is expected; the error page now points them back to Discord.
- Any bookmarked or documented `/revoke?id=…` URL will stop working.
- If `UNLINK_SECRET` differs between the bot process and the web process, every
  unlink fails. They are the same process today, so this only matters after the
  Phase 4 split.

---

## 4. Install and build

```bash
npm ci
npm run typecheck   # must be clean
npm run lint        # must report 0 errors
npm test            # 91 tests
npm run build
```

As of 4.0.0 CI runs all four and refuses to publish an image unless they pass.

---

## 5. What was removed

Confirm nothing external depends on these before deploying.

| Removed | Notes |
|---|---|
| `GET/POST/PUT/DELETE /communitymap` | Every branch returned `500 'Not implemented'`. |
| `GET/POST/PUT/DELETE /communitymap/controversies` | As above. |
| `queryCommunityMap` / the `CM_DATABASE` pool | No remaining callers. `CM_DATABASE` and `CM_AUTHCODE` can be retired from the environment. |
| The automod feed (`AutoModManager`) | Its poll timer was already commented out, so it had not run for some time. Superseded by the external app. |
| The `/automod` slash command | Rules are managed through the external app and the HTTP API. |
| `moderationWebhooks` | Only the automod feed published to Slack and Discord. |
| `v2-latestmods automod.ts`, `v2-updatedMods automod.ts` | Duplicates of their siblings, with a literal space in the filename. |

**Kept:** the `/automod` HTTP CRUD endpoint (`server/AutomodRules.ts`) and the
`automod_rules` / `automod_badfiles` data layer (`api/automod.ts`). The latter
is no longer referenced by the bot itself — it can go too if the external app
owns that schema entirely.

---

## 6. Behaviour changes worth watching after rollout

- **Fewer restarts.** Two `process.exit()` calls were removed: one fired on any
  recoverable gateway error, the other on any failure to reply to an already
  failed interaction. If restart frequency was masking another problem, that
  problem will now be visible in the logs instead.
- **Debug logging is on outside production.** `Logger.debug()` previously only
  emitted when `NODE_ENV=testing`. Expect noticeably more output in dev.
- **`Logger.error`/`warn` now print their extra arguments.** Around 30 call
  sites were passing a third argument that was silently dropped.
- **Subscription channel lists refresh every cycle.** They were only loaded at
  construction, so newly subscribed channels were not picked up until a restart.
- **The news feed timer now runs on the shard that owns the news guild**, rather
  than on every other shard. Watch for duplicate or missing news posts on the
  first run.
- **Automod rule matching is case-insensitive again** — but the feed is removed,
  so this only matters if the external app reuses the same rule semantics.

---

## 7. Rollback

Nothing in this release migrates data, so rollback is a redeploy of the previous
image. The only stateful change is `.env`; the added variables are ignored by
3.16.5, so they can stay in place.

---

## Local git note

`core.autocrlf` was set to `true` in this clone to stop every file showing as
modified (the working tree is CRLF, the index is LF). That is local config only.
Until a `.gitattributes` is committed, teammates will still see the phantom
17,000-line diff — see `MODERNISATION.md` Phase 1.
