# Nexus Mods Discord Bot — Modernisation & Simplification Plan

**Status:** Phase 0 shipped in **3.17.0**. Phases 1, 2, 3.1, 3.2, 3.6 and 5.3 are on the
**4.0.0 branch, built and tested but not yet deployed**. Everything under *The work in
detail* is still a proposal.
**Date:** 29 August 2026 (originally audited at `473db19`)
**Scope:** `nexus-bot-typescript` — 99 source files, ~12,500 lines, plus 16 test files
and 216 tests. The source count is up on the audit's 89 because Phases 1–3 split several
large files apart; the line count is slightly down despite that.

This document is ordered by **what happens next**. Completed work is recorded in full
under *Shipped*, at the bottom — it is kept rather than deleted because most of it
explains why the code looks the way it does.

---

## The immediate next step

**Deploy 4.0.0.** Nothing else on this list should start until it has run in production
for a day.

That is not ceremony. None of the 4.0.0 work has touched a live Discord gateway or a live
database, and the one time it met a real environment — a local Postgres — it failed
immediately on a TLS default that had looked correct in review and had passing tests
behind it. The untested delta has been growing for weeks and now covers the build system,
logging, the error taxonomy, the command contract, migrations, the query layer and the
gateway intents. Deploying bounds it. Waiting means debugging all of it at once, on a box
that is already at 94.4% CPU.

Two other things depend on it. **Migrations have never run against the production
database**, and everything in Phase 3 sits on top of them. And the droplet sizing question
— which blocks Phase 4 — needs real numbers after the intent fix, not the estimates in
this document.

`DEPLOYING.md` has the pre-flight list. The two entries that matter most are
`AUTOMOD_DATABASE` and `WATCHED_CHANNEL_ID`: both now change behaviour by their absence,
and `.dockerignore` excludes `*.env`, so whatever injects configuration at run time has to
carry them.

---

## The order of work

| | Work | Why it is here | Blocked by |
|---|---|---|---|
| 1 | Deploy 4.0.0 | See above | — |
| 2 | **5.4** Move the bait channel out of the main bot | The actual CPU fix. Everything else about the droplet is guesswork until this lands. | Deploy, and a day of graphs |
| 3 | Droplet sizing | Phase 4 has a hardware prerequisite | 5.4 |
| 4 | **3.5** Query error contract | Highest user-visible correctness win left: feeds currently record a failed poll as a successful empty one | Nothing |
| 5 | **3.3** GraphQL codegen | Self-contained, low risk, kills the untyped-boundary bug family | Nothing |
| 6 | **3.4** OAuth token encryption | Highest risk item. ~147,000 values rewritten. | The key-storage decision |
| 7 | **5.1** Replace `broadcastEval` string injection | Sharding is staying, so this is permanent debt | Nothing |
| 8 | **5.2** Dead code sweep | Makes everything after it smaller | Nothing |
| 9 | **Phase 4** Next.js front-end | The largest piece, and the one with the most unknowns | Droplet sizing, repo decision |

3.5 is placed ahead of 3.3 deliberately: it fixes a real defect users can hit, where 3.3
improves how the code is written. 3.4 sits behind both because it is the only item that
can lose data.

---


## Where things stand

Everything below is **on the 4.0.0 branch and not yet deployed**. Full detail for each is
under *Shipped*; this is the one-paragraph version.

**Phase 3.6 (4.0.0).** Runtime import cycles measured against the emitted JavaScript
rather than the source, which corrected an earlier bad count of 185 down to a real 12,
then reduced to 2. Three grab-bag modules split up; `consistent-type-imports` enforced;
a test pins the count. The two that remain are the subscriptions active-record pair.

**Phase 3.2 (4.0.0).** One pool-parameterised `query` replaces the two near-identical
wrappers. The pool config no longer falls back to port 0, no longer disables TLS
verification by accident, has its statement timeout enabled and no longer drops idle
connections after two seconds. Transactions exist, and `updateSavedNews` uses one.
Column names are checked against the schema instead of interpolated. The `bot-db.ts`
barrel is gone.

**Phase 3.1 (4.0.0).** The schema is in the repository for the first time, as
`src/db/schema.ts` plus a drizzle baseline migration generated from it. The baseline
was verified against a schema-only dump of production - applying it to an empty
database reproduces every column, constraint, index and sequence exactly, and
applying it to a copy of the dump changes nothing. Migrations run before any shard
spawns, under a Postgres advisory lock, and a failure now stops the bot from
starting rather than being logged and ignored. `api/migrations.ts`, `ensureNewsDB`
and `ensureSubscriptionsDB` are deleted.

**Phase 2 (4.0.0).** Duplicated embed, profile, collector, game-filter and
permission logic pulled into `src/lib/`. Deferral, link requirement and permission
checks are declared on each command rather than re-implemented inside it.

**Phase 1 (4.0.0).** Build is tsup, transpile-only, ~1.2s. Logging is pino with
credential redaction. One error taxonomy replaced five conventions. Tests run
under vitest, and CI gates on typecheck, lint and tests before publishing an image.

**Phase 0 (3.17.0).** Eight of the nine security findings, and all 21 correctness defects
(B9 included: the `mods` root field does accept `count: Int`, confirmed against the
Nexus website's own `ModsListing` operation).
The community map and the automod feed are removed. The ESLint config, which had
never run successfully, is repaired and reports zero errors. See `DEPLOYING.md`
for what has to be configured before this release goes out.

**Still open, deliberately:**

| Item | Why it is still open |
|---|---|
| **S3** — `POST /webhook` has no authentication | Deferred: the fix depends on what the Invision forum can be configured to send (shared secret header, HMAC signature, or IP allowlist). **Still a Critical finding.** |
| **S9** — OAuth tokens stored in plaintext | Phase 3, alongside the schema work. |
| Query modules still return `[]` on failure | The ~18 v2 query files swallow errors and return an empty result, so callers cannot tell "no results" from "the API is down". Fixing this changes feed behaviour (a transient API error would propagate instead of being a silent no-op cycle), so it belongs with the Phase 3 data-layer contract work rather than being slipped into 1.3. |

**Production scale**, from `/about` on 29 August 2026 — these numbers change what some of
the remaining work involves, so they are recorded rather than left in a chat log:

| | Count | Why it matters |
|---|---|---|
| Servers | 2,418 | 82 short of Discord's 2,500-guild mandatory-sharding threshold. Settles Phase 5: sharding stays. |
| Linked accounts | 36,879 | 3.4 rewrites four token columns on every one of these rows. That is a batched migration with a rollback plan, not an `UPDATE`. |
| Subscribed items | 2,757 | The per-cycle feed workload 3.5 changes the failure behaviour of. |

**The host it runs on**, as of 29 August 2026: DigitalOcean Basic, **1 vCPU, 2 GB RAM,
25 GB disk**, sitting at **94.4% CPU and 80% memory** with none of the 4.0.0 work
deployed. That reframes several things in this document:

- **Phase 4 cannot happen on this droplet.** A Next.js process wants 200-400 MB and CPU
  that is not there. Phase 4 now has a hardware prerequisite, not just a repo decision.
- **The CPU figure had a cause**, and it is fixed in 4.0.0 - see 5.3. The bot was
  requesting six gateway intents and consuming one.
- **Three shards on one core is 3x the process overhead for the same event volume.**
  Sharding still has to stay (2,418 guilds, 2,500 is the hard limit), but the shard count
  and the box size need considering together rather than left at `'auto'`.

**Nothing here has been run against a live Discord gateway or database.** The HTTP
middleware chain and the unlink signing were verified in isolation; the OAuth round
trip, the subscription feed and the news feed have not been exercised end to end.

---

---

## Open decisions

1. ~~**Is automod coming back?**~~ **Answered: no.** Superseded by an external app. The
   feed, the `/automod` slash command and `moderationWebhooks` were removed in 3.17.0; the
   `/automod` HTTP endpoint and the rules data layer stay.
2. ~~**What is the current guild count?**~~ **Answered: 2,418 servers.** That is 82 short
   of the 2,500 at which Discord makes sharding mandatory, so sharding stays and the
   shard-aware branches stay with it. Phase 5 shrinks to the `broadcastEval` protocol
   work, which was worth doing either way. See 5.1.
3. **Monorepo or two repos?** Still open, but no longer the nearest blocker for Phase 4 —
   **the droplet is**. 1 vCPU and 2 GB at 94.4%/80% will not host a Next.js process
   whatever the repo shape. Answer the hardware question first. On the repo itself, which
   assumes a workspace so the bot and web app can share the schema and the Nexus API
   client. Two repos means publishing those as packages, or duplicating them. 3.6 is a
   prerequisite either way.
4. **What can the Invision forum send to `POST /webhook`?** (New.) S3 is the last
   unresolved security finding and the only one still exploitable. The fix depends
   entirely on what the sending side supports: a static shared-secret header, an HMAC
   signature over the body, or a fixed source IP range. Any of the three is a short
   change; picking one without knowing what Invision offers is not.
5. **Where does the encryption key for 3.4 live?** (New.) Encrypting the OAuth tokens at
   rest needs a key, and the key needs somewhere to live that is not the same database.
   An env var is the cheap answer and is a real improvement over plaintext; a managed KMS
   is the better one. This also decides whether key rotation is a feature or a redeploy.

---

---

# The work in detail

---

## 5.4 Move the anti-spam bait channel into its own process

**New, and the highest-value item after the deploy.**

`WATCHED_CHANNEL_ID` is live in production, so the main bot still requests
`GuildMessages` — and intents are per-connection and cannot be scoped to one guild. The
bot therefore receives every message in all 2,418 servers, builds an object for each, and
discards all but one channel's worth. 5.3 removed four unused intents and capped the
message cache, which should show up as a memory drop, but **the dominant event stream is
untouched while this feature lives in the main process**.

The fix is a small separate bot, in the Nexus Mods guild only:

- Intents: `Guilds` + `GuildMessages`, for one server instead of 2,418.
- It needs the bait channel id, a token, and nothing else — no database, no Nexus API.
- The main bot then drops `WATCHED_CHANNEL_ID`, `messageCreate.ts` is deleted, and its
  intent bitfield reaches **1**.

The cost is a second deployable unit on a droplet that is already tight, but the process
is tiny — one gateway connection, no caches, no polling. It should cost far less than the
firehose it removes.

Worth checking while doing it: whether the honeypot still needs a bot at all. Discord's
native AutoMod cannot ban, so probably yes — but the requirement is worth restating before
building a second service around it.


## 3.5 Query modules: the `[]`-on-failure contract

Deferred out of 3.2 deliberately, because it changes feed behaviour rather than internals.

Seven of the twenty modules under `api/queries/` catch their errors and return `[]`, so a
caller cannot tell "the API returned nothing" from "the API is down". For an interactive
command that means a user is told there are no results when the truth is that Nexus Mods
was unreachable. For a feed it is worse in a subtler way: a failed poll looks like a poll
that found nothing, so the cycle is recorded as successful and the window moves on. Any
mods published during an outage are skipped permanently, and nothing in the logs says so.

The change is to let the error propagate and decide, per caller, what to do:

- **Interactive commands** should say the API is unavailable, not "no results".
- **Feeds** should abandon the cycle *without advancing `last_update`*, so the next poll
  covers the same window. This is the part that needs care - it is the difference between
  a missed article and a duplicated one, and the two failure modes want opposite handling.

Needs a test per feed with a forced API failure, asserting the timestamp did not move.

---

## 3.3 GraphQL

Every result shape is hand-written. There is **no codegen** — no `codegen.yml`, no schema
file, no `@graphql-codegen/*` dependency. The cost is visible:

- `Mod` is declared **three times** with different field sets and different types
  (`types/GQLTypes.ts:13-35` has `updatedAt: string`, `api/queries/v2.ts:77-107` has `Date`,
  `feeds/AutoModManager.ts:21-46` has a third). `Collection` twice (one with 20+ `any`
  fields). `User` **three** times, two exported under the same name. `ModStatus` and
  `CollectionStatus` twice each.
- `IModResults` is exported from two files with incompatible shapes.
- `IModsFilter` (`v2.ts:119-144`) is a 26-field hand transcription of the server's input
  type. Schema drift is silent.
- `GQLTypes.ts` contains types no query references: `TrackingState` (literally
  `{ test: number }`), `Tag`, `TagCategory`, `CollectionPage`.

**Add `graphql-codegen` against the Nexus Mods v2 schema.** Types become generated,
`types/GQLTypes.ts` largely disappears, and B9 (undeclared `count` variable) becomes a
build-time error.

Then consolidate the query files:

- ~~`v2-latestmods automod.ts` and `v2-updatedMods automod.ts`~~ were deleted in 3.17.0.
  `v2-latestmods.ts` and `v2-updatedMods.ts` remain ~85% the same file, so **two files
  still express one query.**
- ~~**Two of those filenames contain a literal space.**~~ Both files were deleted with the
  automod feed in 3.17.0, and `add-js-extensions.cjs` — the post-processor that made such
  specifiers survive the build at all — is gone as of 4.0.0.
- Instantiate a single `GraphQLClient` — currently the *function* form of
  `graphql-request` is used at ~18 call sites, so there is no shared timeout, no middleware,
  no connection reuse.
- Add **retry with backoff and `Retry-After` handling**. A repo-wide grep for
  `retry|backoff|rate.limit|429` in `api/` and `feeds/` returns two cosmetic hits. Today a
  Cloudflare block or a 5xx just becomes an empty array.

---

## 3.4 Auth tokens

**Scale:** 36,879 linked accounts, four token columns each (`nexus_access`,
`nexus_refresh`, `discord_access`, `discord_refresh`). Encrypting in place means reading
and rewriting ~147,000 values. It needs batching, it needs to be resumable, and it needs
a decision on what happens to a row that fails to decrypt afterwards — a user whose tokens
are unreadable should be treated as unlinked and asked to re-link, not silently 500.


- `NexusMods.Auth()` is called from only seven interactive paths. Every other call —
  **including the background feed managers** — goes through `headers()`
  (`DiscordBotUser.ts:92-105`), which reads `access_token` without checking `expires_at`.
  Background jobs run on whatever token was loaded from the DB and 401 when it lapses.
  `NexusGQLError` special-cases 401 (`v2.ts:165`) but nothing acts on it.
- No skew window: `NexusModsOAuth.ts` refreshes only `if (Date.now() > tokens.expires_at)`,
  so a token expiring mid-request is used and fails. Use a 60 s margin. (4.0.0 fixed the
  related `NaN` case, where a response without `expires_in` produced an expiry that no
  comparison could ever satisfy — but the margin itself is still missing.)
- If Nexus omits `refresh_token` from a rotation response, `saveTokens` persists `undefined`
  over the stored one. Guard it.
- `Revoke` (`DiscordBotUser.ts:118`) fires and forgets — the row keeps dead tokens.
- ~~`NexusModsOAuth.ts:135` contains `tokens.access_token = tokens.access_token;`~~ —
  removed in 4.0.0 when the repaired ESLint config flagged it as `no-self-assign`.
- Encrypt tokens at rest (pgcrypto or app-level AES-GCM with a KMS key).

---

---

## 5.1 Replace `broadcastEval` string injection

Sharding is staying — 2,418 guilds against Discord's 2,500-per-shard limit, so the
question this section used to ask is settled. What is left is the debt underneath it.

The code half-admits it never wanted shards: almost every subsystem disables itself on
non-zero ones:

- `DiscordBot.ts:168` — only shard 0 registers commands.
- `SubscriptionManager.ts:53-57` — non-zero shards get no timer.
- `AutoModManager.ts:109-112` — non-zero shards skip setup entirely.
- `server/server.ts:33` — the OAuth site only runs on shard 0.

The effective architecture is **one worker plus N idle gateway connections** — and the
shard-aware branches are where B3, B5 and B6 live. `about.ts:58-62` is the only place that
genuinely needs cross-shard data, and its numbers are the ones quoted throughout this
document.

Cross-shard communication is `broadcastEval` **string injection** in four places
(`SubscriptionManager.ts:194-196, 217-233`, `NewsFeedManager.ts:83-87`, `about.ts:60`), with
no message protocol — `handleForceUpdate` is a public method reachable only through an eval.

**Answered, and the earlier recommendation is withdrawn.** Production reports **2,418
servers**. Discord's limit is 2,500 guilds per shard, and an app in 2,500+ guilds *must*
shard — a bad shard configuration past that point closes the gateway with code `4010`.
That is **82 guilds** of headroom. Deleting `shards.ts` would buy a simpler codebase for
a few weeks and then force the work to be redone under time pressure.

So: **sharding stays.** What remains of this section is the part that was always worth
doing regardless of the count — replacing `broadcastEval` string injection with a typed
IPC message protocol. Four call sites (`SubscriptionManager.ts:194-196, 217-233`,
`NewsFeedManager.ts:83-87`, `about.ts:60`) currently send JavaScript source as strings,
with no protocol and no types; `handleForceUpdate` is a public method reachable only
through an eval.

The shard-0-only guards stay too, and they are load-bearing rather than vestigial: with
`totalShards: 'auto'` Discord hands back roughly one shard per thousand guilds, so this
bot is already running several processes in production. That is also why the migration
advisory lock added in 3.1 matters — several shards do start at once.

**Also in `shards.ts`:** `'Shard X died', true` (`:13`) still has a leftover argument.
The version-gated migrations were removed in 3.1.

Also in `shards.ts`: the version-gated migrations (dead), and `'Shard X died', true`
(`:13`) with a leftover argument.

---

## 5.2 Dead code inventory

Rows marked ✓ have been removed — in 3.17.0 (community map, automod, duplicate queries)
or 4.0.0 (build scripts, unused dependencies).

| Item | Location | Lines |
|---|---|---|
| ~~`communitymap` route stubs~~ | `server/CommunityMap.ts` | 139 ✓ |
| ~~Unreachable automod analysis~~ | `feeds/AutoModManager.ts` | ~330 ✓ |
| ~~Events discord.js v14 never emits~~ | renamed to `shardReconnecting` / `shardResume` | 24 ✓ |
| Version-gated migrations for 3.13.0 / 3.13.1 | `api/migrations.ts`, `shards.ts:21-22` | ~60 |
| ~~`add-js-extensions.cjs` + `clean.cjs`~~ | root | ~90 ✓ |
| ~~`build.sh` (pre-TypeScript fossil)~~ | root | 6 ✓ |
| ~~Duplicate query files with spaces in the names~~ | `api/queries/*automod.ts` | ~190 ✓ |
| Unused types: `PermissionsExt`, `ClientExt.commands`, `DiscordEventInterface.name`, `TrackingState`, `Tag`, `TagCategory`, `CollectionPage` | `types/` | ~50 |
| ~~Unused deps: `jsonwebtoken`, `@types/jsonwebtoken`, `path`~~ | `package.json` | — ✓ |
| ~~The `/automod` slash command~~ | `interactions/automod.ts` | 428 ✓ |
| ~~`moderationWebhooks` (only the automod feed used it)~~ | `api/moderationWebhooks.ts` | 85 ✓ |
| ~~`queryCommunityMap` + the `CM_DATABASE` pool~~ | `api/dbConnect.ts` | 25 ✓ |
| Large commented-out blocks | `SubscriptionManager.ts:680-715`, `about.ts:27-44,65-67`, `search.ts:467-474`, `refresh.ts:139-140`, `automod.ts:421-423`, `NewsFeedManager.ts:67,150,152` | ~90 |
| Stale `logMessage(...)` calls from a previous logger, commented rather than migrated | 19 sites across `search.ts`, `SubscriptionManager.ts`, `AutoModManager.ts`, `link.ts` | 19 |
| Unused private functions with a stray `console.log` | `api/util.ts:233-247` | 15 |

**~1,000+ lines deletable with no behaviour change.**

Small copy fixes worth doing at the same time: `/delete-user` is described as
`'Testing Command.'`; `/trigger-update` carries `/tips`' description; `search.ts:135` names
a variable `showToAll` and passes it as `ephemeral`; `"Neuxs Mods OAuth Error"`
(`server/server.ts:275`, `NexusModsOAuth.ts:173`); `search.ts:633` has a hardcoded 100 ms
sleep papering over an ordering race.

---

---

## Phase 4 — The Next.js front-end (3–4 weeks)

**Recommendation: a separate Next.js app in the same repo, sharing types and DB access with
the bot through a workspace package.**

### 4.1 Why the split is clean

Of the 19 routes, only **one** touches live Discord gateway state:

- `GET /tracking` calls `client.guilds.fetch()`, `guild.iconURL()`, `guild.channels.fetch()`
  (`server/server.ts:358-362`).

Everything else is HTTP + Postgres + Discord REST:

| Moves cleanly | Notes |
|---|---|
| `/linked-role`, `/discord-oauth-callback`, `/nexus-mods-callback`, `/success`, `/oauth-error`, `/unlink-error` | `DiscordOAuth.ts` and `NexusModsOAuth.ts` are pure `fetch` wrappers with **zero discord.js imports** |
| `/revoke`, `/update-metadata`, `/show-metadata` | `PushMetaData`/`GetRemoteMetaData` go over `discord.com/api/v10`, not the gateway |
| `/automod` | Pure Postgres via `queryAutoMod` |
| `POST /webhook` | Uses `EmbedBuilder` only to build a JSON body, then plain `axios` to webhook URLs |
| `/`, `/nxm`, `/localhost-redirect`, `/timestamp` | Stateless |
| `/communitymap`, `/communitymap/controversies` | **139 lines that all return `500 'Not implemented'`. Delete rather than port.** |

**Note the shard-0 problem this fixes:** the site only runs on shard 0
(`server/server.ts:33`), but with `totalShards: 'auto'` shard 0 does not hold every guild —
so `/tracking` already fails for guilds on other shards. Moving it to a Next.js app that
hits the Discord REST API directly, or a small internal bot endpoint with `broadcastEval`,
fixes a bug rather than creating one.

### 4.2 What must be solved

1. **`TempStore`** (`server/server.ts:28`) is a process-local `Map` holding Discord tokens
   between the two OAuth callbacks, TTL'd by a bare `setTimeout`. On any multi-instance
   deploy the two callbacks can land on different instances and the link silently 403s.
   Replace with an encrypted cookie (`iron-session`) or Redis.
2. **Signed cookies.** `clientState` and `ErrorDetail` use `cookie-parser` signing, which has
   no Next.js equivalent. Move to encrypted session cookies — this also fixes S7.
3. **Redirect URIs** are registered with two external providers
   (`DISCORD_REDIRECT_URI`, `NEXUS_REDIRECT_URI`). Changing origin or path requires console
   changes on both Discord *and* Nexus Mods. Plan for a cutover window, or keep the paths
   identical.
4. **Seven hardcoded URLs in the bot** point at `https://discordbot.nexusmods.com/...`
   (`interactions/link.ts:45,79,86`, `claimrole.ts:35,41`, `refresh.ts:118`, `search.ts:447`,
   `unlink.ts:29,39`, `types/subscriptions.ts:426,464`). Move to config **before** the split.
5. **`/success` carries its result in query params** and is therefore forgeable by anyone.
   Fix during the port.

### 4.3 What you get

There is nothing worth preserving stylistically:

- 16 EJS files, 237 lines, **22.5 KB — of which `header.ejs` alone is 12 KB**, almost
  entirely one inline `<symbol>` SVG. Actual hand-written body markup is ~10 KB.
- No layout engine. `header.ejs` opens `<html>`/`<body>`/`<main>` and `footer.ejs` closes
  them — an unbalanced fragment pair that only works via string concatenation.
- `styles.css` is **213 lines**, hand-written, no preprocessor, no variables, colours
  (`#2b2d2f`, `#d98f40`, `#55b8e4`) repeated as literals. Every class is prefixed
  `maintenance-page__` — it was lifted from a Nexus Mods maintenance page and never renamed.
  `styles.css:171-213` is a second, differently-indented block appended for `/tracking`,
  with a duplicate `table {}` rule.
- No client-side JS at all (`footer.ejs:1` has the script tag commented out).
- Heavy inline `style=` attributes across six templates.

So: **Next.js App Router + Tailwind + your internal design system**, aligning with the other
Nexus internal projects. `trackingInfo.ejs:35` calls `timeAgo(sub.last_update)` — a function
passed in as an Express local, and the only genuinely non-portable binding. It becomes a
plain import.

### 4.4 Suggested shape

```
/apps
  /bot            # discord.js — gateway, commands, feeds
  /web            # Next.js — OAuth, status, tracking, automod admin
/packages
  /db             # Drizzle schema + migrations + queries  (shared)
  /nexus-api      # GraphQL client + generated types       (shared)
  /shared         # domain types, formatting helpers       (shared)
```

pnpm workspaces + Turborepo. This is the only structural change in the plan, and it exists
because the bot and the web app genuinely need to share the schema and the Nexus API client.

**Sequencing:** stand up `/apps/web` alongside the Express app, port routes group by group
behind a reverse proxy, and retire `server/` last. No big-bang cutover.

---

---

## Sequencing and effort

| Phase | Effort | Risk | Ships |
|---|---|---|---|
| ~~0 — Security + crash bugs~~ | 3 days actual | Low | **shipped, 3.17.0** ✓ |
| ~~1 — Build, logging, errors, tests, CI~~ | 1 week actual | Low | **shipped, 4.0.0** ✓ |
| ~~2 — Command framework + dedupe~~ | ~1 week actual | Medium | **on 4.0.0** ✓ |
| ~~3.1 — Migrations~~ | 1 day actual | Medium | **on 4.0.0** ✓ |
| ~~3.2 — Query layer~~ | 1 day actual | Medium | **on 4.0.0** ✓ |
| 3.3 — GraphQL codegen | 3–5 days | Low | Query by query |
| 3.4 — Auth token encryption (S9) | 2–3 days | **High** | One migration, not reversible in place |
| 3.5 — Query error contract | 2–3 days | Medium | Changes feed behaviour |
| ~~3.6 — Import cycles~~ | 1 day actual | Low | **on 4.0.0** ✓ (2 left, documented) |
| 4 — Next.js split | 3–4 weeks | Medium | Route group by route group |
| 5 — Sharding decision + dead code | 1 week | Low | Any time |

**Remaining: roughly 5–7 weeks of one engineer**, down from 7–10 at the last revision.
Phases 0–2 and 3.1–3.2 took about two and a half weeks against a 5.5–9 week estimate,
so the remaining figures are probably still pessimistic — but 3.4 and Phase 4 are the two
items with genuine unknowns in them, and they are what the estimate hangs on.

**Order matters in two places.** 3.6 is done, so the Phase 4 prerequisite is met. 3.4 should not run at the same time
as anything else touching `users`, since it rewrites every token column. 3.5 wants to land
on its own, so that a change in feed behaviour can be attributed if something looks wrong
after a deploy.

---

---

# Shipped

Kept in full rather than summarised. Most of it is the explanation for why a particular
piece of code looks the way it does, and that is worth more in the repository than a
changelog line.

---

## 4.0.0 — built, not yet deployed


### Phase 1 — Foundations — **shipped in 4.0.0**

Delivered as five commits on `phase-1-foundations`, one per workstream.

#### 1.1 Build pipeline ✓

`clean.cjs` → `tsc --build` → `add-js-extensions.cjs` → three `copyfiles` calls is now
`tsup`. **Build time: ~15s → ~1.2s.**

- Source carries explicit `.js` specifiers on all 281 relative imports, so nothing has to
  rewrite the output. `add-js-extensions.cjs`, `clean.cjs` and `build.sh` are deleted.
- **Transpile-only (`bundle: false`).** `DiscordBot.ts` `readdir`s `dist/interactions` and
  `dist/events` and imports each file it finds, so bundling would collapse them and break
  command registration. Verified by loading all 30 modules through that same path.
- `tsconfig` moved to `module`/`moduleResolution: NodeNext`, which validates those
  extensions at compile time.
- Asset copying is `scripts/copy-assets.mjs` using `fs.cp`. The old `copyfiles` globs were
  single-level and used `-f` (flatten), so anything in a subdirectory was silently dropped.
- Dockerfile is multi-stage on node 22, `npm ci`, runs as `node` not root, prunes dev
  dependencies. **`CMD` is exec form now** — the shell form left `/bin/sh` at PID 1
  swallowing SIGTERM, so `docker stop` waited out its timeout and SIGKILLed the bot
  mid-poll.
- Removed `jsonwebtoken`, `path` and `copyfiles`; `@types/*` moved to devDependencies.

**Not in the plan — two real bugs NodeNext exposed:**

- The tsconfig omitted `lib`, so TypeScript pulled the **DOM** library into a node-only
  project and `Response.json()` resolved to `any`. Every fetch body was trusted without
  anyone deciding to. Now `unknown`, with a `readJson<T>` helper at 11 call sites.
- `expires_in` is optional on every OAuth response we model, and
  `Date.now() + expires_in * 1000` is `NaN` when it is absent. Every comparison against
  `NaN` is false, so `Date.now() > expires_at` never fired — **a token that arrived
  without `expires_in` would never have been refreshed.** `expiresAt()` now treats a
  missing value as already-expired.

Also `fuse.js` 6 → 7, which was needed for real ESM types under NodeNext.

#### 1.2 Logging ✓

pino, behind an adapter that keeps the existing `logger.info(message, data)` shape — so
none of the ~300 call sites moved.

- Levels via `LOG_LEVEL`, defaulting to `info` in production and `debug` elsewhere. This
  replaces `DEBUG_LOGGING` and the inverted `isTesting` check behind it.
- JSON in production, `pino-pretty` in development, resolved defensively so a pruned
  image does not crash at startup.
- **Redaction**: a depth-capped, cycle-safe scrubber. Substring matching catches
  `token`/`secret`/`password`/`authorization`/`cookie` and the `nexus_*`/`discord_*`
  columns; a separate exact-match list catches `values`, `params` and `bindings`, which are
  only dangerous under those precise names — `values` being the pg bind array that *is* the
  token array on user writes.
- Trailing arguments now land under `extra`. The old `error()` and `warn()` accepted
  `...args` and dropped them at ~30 call sites.
- All 22 remaining `console.*` calls swept, including `shards.ts`, which had no logger.

**The instance moved out of `DiscordBot.ts` into `api/logger.ts`.** Five modules under
`api/` imported it from there, which meant the data layer could not be loaded without
booting the Discord client — the main obstacle to Phase 1.4.

#### 1.3 Errors ✓

One taxonomy — `AppError` with `cause`, a `code`, `userMessage` and `isOperational`, plus
`DatabaseError`, `NexusApiError`, `DiscordApiError`, `NotFoundError` and `ConfigError` —
replacing all five conventions. `handleDatabaseError` no longer returns a `string`, so the
data layer no longer throws bare stackless strings.

Two behavioural bugs fell out of the conversion:

- `servers.updateServer` counted failures and returned a boolean, discarding the actual
  database error. A failed settings save was indistinguishable from a successful one.
- `servers.getServer` recursed into itself after inserting a missing row, which could loop
  if the insert succeeded but the row was not yet visible.

It also closed the S6 leak structurally: `unexpectedErrorEmbed` rendered `err.message`
straight into a Discord embed, and `sendUnexpectedError` put the same text in the context
block. Users now get `userMessage` for an `AppError`, a fixed line for anything else, and
a short reference id that the full error is logged against.

**Deferred deliberately:** the ~18 query modules still return `[]` on failure. Changing
that alters feed behaviour, so it belongs with the Phase 3 data-layer contract work.

#### 1.4 Tests ✓

**91 tests under vitest, ~27s.** Weighted towards code where a regression is expensive
rather than towards a coverage number: 23 on the Phase 0 security fixes, 18 on redaction,
18 on the error taxonomy, and regression tests for B8 and the `expires_in` NaN bug.

**Each was verified by reintroducing the original bug** — the B8 slice, the fail-open auth
check, the `expires_in` NaN and the `values` redaction gap. Five tests failed, and only the
expected five.

Two supporting changes: `calcUptime`, `nexusModsTrackingUrl` and `gameArt` moved to
`api/formatting.ts`, because `api/util.ts` imports discord.js and a unit test for a string
formatter pulled ~15s of module loading with it; and the two changelog trimmers are
exported for tests. Tests live in `tests/` so tsup's `src/**/*.ts` entry glob does not
compile them into `dist/`.

#### 1.5 CI ✓

- A `checks` job runs `npm ci`, typecheck, lint and test on push **and pull request**.
  `docker` needs it, so nothing publishes unless all three pass.
- Images are tagged with the version and the commit sha as well as `latest`. Previously
  only `:latest` was published, so there was no earlier image to roll back to.
- Concurrency group cancels superseded runs; npm and buildx layer caching.
- **`joelwmale/webhook-action@master` removed rather than pinned.** A third-party action on
  a moving branch runs arbitrary code in a job that can read this repository's secrets. The
  step is one HTTP POST, so it is `curl` now — with `--fail`, so a failed deploy fails the
  job instead of passing silently.
- `engines: node >=22`, matching the image and the tsup target.

---

---

### Phase 2 — Simplify the bot core — **shipped in 4.0.0**

**Starting position after 4.0.0:** the async problems in this phase now have a number.
~~38 `no-floating-promises` / `no-misused-promises` findings~~ — **cleared, and both rules
are `error` now**, so CI will not let another in. The `/automod` command and `AutoModManager` referenced below no longer
exist, so the duplication figures for this phase are smaller than the audit's.

#### 2.1 A real command contract

`types/DiscordTypes.ts:29-39` types `action` as taking `Client` and `CommandInteraction`.
The consequences ripple through every command:

- **23 of 24 commands** open with the identical line
  `const interaction = (baseInteraction as ChatInputCommandInteraction);`
- **14 builders** need `as SlashCommandBuilder` because `addSubcommand()` narrows the type.
- Commands that need `client.subscriptions` re-declare the signature as `ClientExt`, which
  only compiles because `interactions` is `Collection<any, any>` (`DiscordTypes.ts:13-14`).
- `permissions?: PermissionsExt[]` is never set or read — vestigial from pre-v9 command
  permissions. `aliases` is read but never set. `ClientExt.commands` is never used.
  `DiscordEventInterface.name` is never read (events register by **filename**,
  `DiscordBot.ts:105`) — which is why `clientReady.ts:15` still says `name: 'ready'`.

Replace with a generic, discriminated contract:

```ts
type CommandHandler<T extends Interaction> = (ctx: {
  client: ClientExt;
  interaction: T;
  logger: Logger;
  user?: DiscordBotUser;      // resolved by middleware
}) => Promise<void>;
```

…and a small **middleware chain** in `events/interactionCreate.ts` handling the three things
every command currently reimplements:

- **defer** — currently spelled five different ways across 23 commands
  (`{ephemeral: true}`, `{flags: MessageFlags.Ephemeral}`, `{ephemeral: show}`, bare, and
  a conditional), nine of them with a `.catch(err => { throw err })` no-op.
- **account-link gating** — reimplemented per command with different UX in at least six
  places; `getUserByDiscordId` is called 25 times across `interactions/`.
- **permission checks** — `PermissionFlagsBits.Administrator` repeated at
  `automod.ts:160,233,260,333`, while `settings.ts:132` uses
  `memberPermissions?.toArray().includes('ManageGuild')`.

Expected saving: **20–30 lines of ceremony per command × 24 commands**.

#### 2.2 Kill the duplication

| Target | Current | Proposed |
|---|---|---|
| `interactions/track.ts` | 461 lines, four functions (`trackGame`/`trackMod`/`trackCollection`/`trackUser`) sharing an identical skeleton — including the same copy-pasted quota block with the same dead commented line, and the variable named `currentGameSub` in all four | One generic `track(kind, …)` driven by a per-kind descriptor. ~150 lines. |
| ~~`interactions/automod.ts`~~ | 428 lines of three byte-for-byte duplicated pairs | **Deleted in 3.17.0** with the automod feed ✓ |
| `interactions/search.ts` | 639 lines, 14 `EmbedBuilder` sites; `searchMods` (:278-387) and `searchCollections` (:164-276) are the same ~110-line function | Split into `search/` with a shared result-renderer. |
| Embeds | 56 `new EmbedBuilder` sites; brand colour `0xda8e35` hardcoded **31 times**; footer `'Nexus Mods API link'` 10 times; `client.user?.avatarURL() \|\| ''` ~20 times; `notAllowed()` and `botUser()` duplicated verbatim between `whois.ts` and `user-profile.ts` | A `lib/embeds.ts` with `nexusEmbed(client)` returning a pre-branded builder. |
| Pagination / collectors | Hand-rolled **7 times** with no shared helper (`search.ts` ×2, `settings.ts`, `tips-manager.ts` ×3, `untrack.ts`), timeouts ranging 30 s to **3,600,000 ms** (`untrack.ts:66`), two of them non-functional (B17) | One `paginate()` helper with a standard timeout and correct teardown. |

#### 2.3 Modernise discord.js usage

| Deprecated | Sites |
|---|---|
| `ephemeral: true` → `flags: MessageFlags.Ephemeral` | `mytoken.ts:22`, `profile.ts:32`, `refresh.ts:59`, `whois.ts:50,81,88`, `search.ts:138,384,391` |
| `fetchReply: true` → `withResponse` | `search.ts:256` (note `search.ts:363`, the sibling branch, **already** uses `withResponse` — the two collectors have diverged) |
| `.setDMPermission()` → `.setContexts(InteractionContextType…)` | `link.ts:15`, `search.ts:42`, `tips.ts:26` (most other commands already migrated) |
| `interaction.fetchReply()` for a collector target | `settings.ts:311`, `tips-manager.ts:216` |
| Mutating `interaction.ephemeral` | `interactionCreate.ts:72` |
| `name: 'ready'` | `clientReady.ts:15` (dead field, but misleading) |

Consider **Components V2** (`ContainerBuilder`) for the richer outputs — search results and
subscription digests especially — once `lib/embeds.ts` exists.

#### 2.4 State

- Fold the `ClientExt` grab-bag (`gamesList`, `tipCache`, `newsFeed`,
  `subscriptions`, `interactions`, `commands`, `config: any`) into a typed **service
  container** passed into the command context. `config: any` is why `whois.ts` read
  `config.ownerID` while the real field is `ownerIDs` (B16, fixed in 3.17.0) — the point
  stands: a typed container would have made that a compile error rather than a silent
  `undefined`, and nothing prevents the next one.
- `client.gamesList` is initialised **twice** (`DiscordBot.ts:79` and `clientReady.ts:22`).
- `TipCache` fires an un-awaited `getAllTips()` in its constructor and is lazily constructed
  in four places with `if (!client.tipCache) client.tipCache = new TipCache()` — a race under
  concurrent commands.
- ~~The module-level mutable logger singleton in `DiscordBot.ts`~~ — moved to
  `api/logger.ts` in 4.0.0; `setShardId` creates a pino child rather than mutating shared
  state, and `automod` has gone from the `ClientExt` grab-bag with the feed.
- Module-level mutable state to remove: the shared `EmbedBuilder` in `clientReady.ts:10-12`
  (timestamp mutated at `:38`, then sent to every guild in a loop at `:55`); the shared
  button builders in `tips-manager.ts:67-102`.
- `SubscriptionManager.channels` is mutated from five places with no owner; `channelGuildSet`
  is cleaned up in two of the removal paths but not the others — a slow leak of guild IDs.
- `prepareCache` (`SubscriptionManager.ts:731-786`) loads all subscriptions plus every
  new/updated mod per tracked game into memory via `Promise.allSettled` over an unbounded
  array. Add a concurrency cap (`p-limit`).
- The naked `setTimeout(() => this.updateSubscriptions(), 90000)` at
  `SubscriptionManager.ts:68` has no error handling — a rejection there is unhandled.

#### 2.5 Split the giants

`SubscriptionManager.getUpdatesForChannel` (124 lines, six responsibilities),
`getGameUpdates` (107 lines — two near-identical halves), `getUserUpdates` (118 lines —
a third copy of the same shape plus 36 lines of commented code),
`DiscordBot.setInteractions` (105 lines doing four jobs),
`claimrole.ts::action` (112 lines with a hand-rolled AND/OR evaluator),
`AutoModManager.analyseMod` (65 lines, four concerns).

---

---

### Phase 3 — Data layer (the parts that shipped)

3.3, 3.4 and 3.5 are still outstanding and are described under *The work in detail*.

#### 3.1 Migrations — **done (4.0.0)**

There was no migration system. `api/migrations.ts` holds two ad-hoc functions gated on
`process.env.npm_package_version === '3.13.0' / '3.13.1'` (`shards.ts:20-23`) — current
version is **3.16.5**, so neither can ever run again, and they only ran under
`dist/shards.js`, never `dist/app.js`. Schema is created lazily by `CREATE TABLE IF NOT EXISTS`
scattered through the data layer (`api/subscriptions.ts:301-341`, `api/news.ts:37-55`), and
the tables `users`, `servers`, `tips`, `automod_rules`, `automod_badfiles`,
`server_role_conditions` **have no creation code in the repo at all** — the schema exists
only in production.

**Shipped with drizzle-kit.** `src/db/schema.ts` is written from a schema-only dump of
production; `drizzle/0000_baseline.sql` is generated from it; `src/db/migrate.ts` applies
migrations from `shards.ts` before any shard spawns, and from `app.ts` when it is started
standalone.

Four things worth recording, because they would each have been silent:

- The first generated baseline **did not match production**. It put a primary key on
  `game_feeds._id` that production does not have, dropped that column's serial default,
  and renamed two constraints production spells `fk_parent` and `name and server`.
- Every identity column in production was created `START WITH 0 MINVALUE 0`, three of them
  `CYCLE`. Drizzle's defaults are `START WITH 1 MINVALUE 1 NO CYCLE`.
- `ensureSubscriptionsDB` was not merely redundant, it was **wrong**: it created
  `subscribeditems` with `error_count INT NOT NULL DEFAULT 0` and without `nsfw`, `sfw`,
  `show_new`, `show_updates` or `last_status`. Any database built by that path already
  differed from production.
- Production has an orphaned sequence, `mod_feeds__id_seq`, owned by no table, and three
  orphaned tables (`game_feeds`, `user_mods`, `user_servers`) that no code reads. The
  tables are modelled so drizzle does not propose dropping them; the sequence is left
  alone and noted in `DEPLOYING.md`.

Verification was a real loop, not an inspection: Postgres 16 loaded with the production
dump, the baseline applied to an empty database, and `information_schema`, `pg_indexes`
and `pg_sequences` diffed between the two until they were identical. Concurrency was
tested the same way — four processes migrating an empty database at once succeed with
the advisory lock and one of them fails without it.

---

#### 3.2 Query layer — **done (4.0.0)**, except the error contract

- Collapse `queryPromise` and `queryAutoMod` into one pool-parameterised function.
  ~~`queryCommunityMap`~~ went with the community map in 3.17.0, and the copy-pasted
  `'Error acquiring CM client'` log line in `queryAutoMod` was corrected then too — so
  this is now two near-identical wrappers rather than three.
- Fix the pool config: `port: process.env.PORT ? parseInt(...) : 0` falls back to **port 0**
  and collides with the conventional `PORT` variable (the web server uses `AUTH_PORT`).
  `idleTimeoutMillis: 2000` tears down connections after 2 s idle. `statement_timeout` is
  commented out. `ssl: { rejectUnauthorized: false }` applies whenever `NODE_ENV` is
  production **or undefined**.
- Add a transaction helper. There are none today — `api/news.ts:19-35` does `DELETE` then
  `INSERT` as two unrelated statements; a crash between them loses the news cursor.
- Remove the identifier interpolation in `api/users.ts:114-120` and `api/servers.ts:45-51`
  (column names from `Object.entries`, `newData: any`). Not exploitable today because keys
  are code-controlled, but the type system cannot enforce that.
- `getCountOfUsers` declares `{count: number}` then does `Number(rows[0].count)` because
  `pg` returns `COUNT(*)` as a string. Either configure a type parser or type it honestly.
- `api/bot-db.ts` is a 29-line re-export barrel that omits `subscriptions.ts` entirely, so
  there are **two import graphs for the same functions**. Pick one.

**Shipped.** All of the above except the query modules' `[]`-on-failure contract,
which is deferred to 3.5 because it changes feed behaviour and deserves its own testing.

Two things found while doing it:

- **`AUTOMOD_DATABASE` was unset.** `pg` does not error on an undefined database name -
  it falls back to `PGDATABASE` and then to the *user name* - so the automod rules API
  was querying a database nobody had configured. It now fails with a message naming the
  setting. Worth checking what the deployed environment has.
- **Import cycles.** A count of 185 was reported here at the time and it was wrong: it
  came from a source-level scan that counted type-only imports, which the compiler
  erases. Measured against the emitted JavaScript the real figure was **12**. See 3.6,
  which corrects it and takes it to 2.

**A note on ORMs:** the SQL here is simple and mostly parameterised. Drizzle would give you
typed rows and migrations from one tool, which is attractive. Kysely gives typed SQL with
less magic. Either is defensible; staying on raw `pg` with a migration tool bolted on is
also defensible. What is *not* defensible is having no migrations.

---

#### 3.6 Import cycles — **done (4.0.0)**

Not in the original plan; added after 3.2.

**A correction first.** This section previously reported 185 cycles, 177 of them "real at
runtime". Both numbers were wrong. They came from scanning the TypeScript source and
counting every import, including type-only ones — which TypeScript erases, so they cannot
form a runtime cycle. Measured against the emitted JavaScript in `dist/`, the only
measurement that means anything, the real starting point was **12**. The lesson is worth
keeping: measure the artefact that runs, not the source that produces it.

**12 → 2.** All three fixes were the same shape — a module that had accreted unrelated
things, so importing one of them dragged in everything else:

| Was | Why it cycled | Now |
|---|---|---|
| `NexusAPIServerError` in `types/util.ts` | That file also holds `GameListCache`, which calls `other.Games()` → `queries/all.ts` → `queries/v1.ts`, which needed the error | `types/NexusAPIError.ts`, no dependencies but the Axios error type |
| Six autocomplete handlers in `api/util.ts` | Each builds a `DiscordBotUser`; `DiscordBotUser` imports `api/util.ts` back, with `api/users.ts` in between | `src/lib/autocomplete.ts` — they are interaction helpers, not utilities |
| `userEmbed` / `userProfileEmbed` in `api/users.ts` | `DiscordBotUser` imported persistence purely to render itself | `lib/profile.ts`; they take the user as a parameter, so the edge is type-only and erased |
| `DiscordBotUser` calling `updateUser` | The model imported persistence to save itself; persistence imported the model to build return values | `api/userRecord.ts` — row in, row out, no model. `users.updateUser` wraps it |

`@typescript-eslint/consistent-type-imports` is on as an error and converted 235 imports.
**On its own it changed nothing at runtime** — the compiler was already eliding them. It
is insurance: if `verbatimModuleSyntax` or `isolatedModules` is ever enabled, or the build
moves to a bundler, implicit elision stops and every one of those edges becomes real.

**Two cycles remain, deliberately.** `SubscribedChannel` and `SubscribedItem` are
active-record classes whose methods call the persistence layer, while the persistence
layer constructs them in ten places. Splitting model from storage across a 730-line file
is its own change with its own testing, and it is the code behind 2,757 live
subscriptions. It is benign today: neither module touches the other at module scope, only
inside methods, so ESM's live bindings are resolved by the time anything runs. The options
when it is tackled, in increasing order of invasiveness: move the four persistence calls
out to the callers; inject a store interface at a composition root; or fully separate the
row types from the behaviour.

`tests/architecture/cycles.test.ts` pins the count and names the known pair, so a new one
fails CI. It analyses source rather than `dist`, which is only trustworthy *because* the
lint rule makes every type-only import explicit — the result was checked against the
emitted JavaScript and matches exactly. Verified by introducing a real cycle and
confirming the test fails and names the offending edge.

---

### Phase 5 — Runtime (the part that shipped)

5.1, 5.2 and the new 5.4 are still outstanding, above.

#### 5.3 Gateway intents — **done (4.0.0)**

Found while answering "can the droplet host Phase 4". It is a Phase 5 item by subject
matter - what the bot asks Discord for - but it was fixed immediately because the box is
at 94.4% CPU today.

An intent is a subscription to a firehose. Every event it admits is decompressed, parsed,
turned into a discord.js object and cached, on every shard, across all 2,418 guilds,
whether or not a handler exists. **Six were requested. One is consumed.**

| Intent | Consumed by | Verdict |
|---|---|---|
| `Guilds` | The guild and channel caches the whole bot depends on | Keep |
| `GuildMessages` | One anti-spam handler that returns on its second line unless `WATCHED_CHANNEL_ID` is set | Now requested **only when that variable is set** |
| `GuildMessageReactions` | Nothing — no reaction handler exists | Dropped |
| `GuildIntegrations` | Nothing | Dropped |
| `GuildWebhooks` | Nothing — webhooks are created over REST, which needs no intent | Dropped |
| `DirectMessages` | Nothing — `createDM`/`send` are REST; the intent only receives | Dropped |

Intent bitfield **5681 → 513 in production**, where `WATCHED_CHANNEL_ID` is set, and
**5681 → 1** locally and anywhere else the bait channel is not configured.

**The production win is smaller than that first looks, and it is mostly memory.** The
message firehose stays, because the anti-spam feature is live and the intent cannot be
scoped to one guild. What production actually gains:

| | Effect |
|---|---|
| `GuildMessageReactions` dropped | Every reaction add/remove across 2,418 guilds stops arriving. In large servers this is a real share of gateway traffic, but it is not the dominant one. |
| `GuildIntegrations`, `GuildWebhooks`, `DirectMessages` dropped | Low-volume events. Small. |
| `MessageManager: 0` | **Probably the largest single item.** discord.js was holding 200 messages per channel across every channel in every guild, swept only hourly, while nothing read the cache. |
| `GuildMessages` retained | The dominant event stream is unchanged. |

So: expect memory to move, and CPU to move less. **The CPU fix is to move the bait channel
into its own process** - a small bot in the Nexus Mods guild only, requesting
`Guilds + GuildMessages` for one server instead of 2,418. The main bot then drops to
`Guilds` alone. That is the change that takes production to a bitfield of 1.

Intents are per-connection and cannot be scoped to a guild, which is the whole problem:
one channel's worth of anti-spam cost every message in 2,418 servers. If that feature is
wanted permanently it belongs in a small separate process that is only in the Nexus Mods
guild. **Confirmed live in production.** It is absent from the working `.env` only because the
local test bot is not in the main Discord server.

Message and reaction caches are capped at zero; nothing reads `messages.cache` and
discord.js otherwise keeps 200 per channel. `GuildMemberManager` is left uncapped on
purpose — without the `GuildMembers` intent it only fills from explicit fetches, and
capping it would turn the uploader lookup in `types/subscriptions.ts` into a REST call per
announcement.

`tests/architecture/intents.test.ts` pins it, because the failure mode is invisible in
development: in a handful of test guilds an unused intent costs nothing.

---

## 3.17.0 — shipped

### Phase 0 — Stop the bleeding (days, not weeks)

These are live defects, not modernisation. Ordered by blast radius.

#### Security

| # | Issue | Location | Impact |
|---|---|---|---|
| S1 | **Inverted auth check.** `checkPermission` returns `true` when the `Authorization` header does *not* match; the caller does `if (!checkPermission(req)) 401`. A wrong or absent header **passes**; the correct one gets 401. | `server/AutomodRules.ts:6-9`, guarding CRUD at `:110-157` | Unauthenticated INSERT/UPDATE/DELETE on the automod rules table. Same bug at `server/CommunityMap.ts:3-6` (harmless only because every branch is a 500 stub). `AUTOMOD_AUTHCODE` is not in `.env`, so the check is a no-op regardless. |
| S2 | **Unauthenticated account deletion via GET.** `GET /revoke?id=<discordId>` takes a public Discord ID from the query string with no session, token or ownership check, revokes both OAuth grants and deletes the row. | `server/server.ts:328-341` | Anyone can unlink any user. Because it is a GET it fires from an `<img>` tag or a link unfurl. The bot hands these URLs out as buttons (`interactions/link.ts:79`, `unlink.ts:29,39`). |
| S3 | **Unauthenticated webhook.** `POST /webhook` has no HMAC, shared secret or IP allowlist, replies `200` before processing, then forwards attacker-controlled `title`, `author.name`, `author.photoUrl`, `content`, `url` into a Discord embed. | `server/forumWebhook.ts:14-36, 99-113` | Arbitrary embeds with spoofed author and arbitrary link target posted into the Nexus Discord. |
| S4 | **Info disclosure.** `GET /show-metadata?id=` returns any user's Discord role-connection metadata, unauthenticated. Also `JSON.stringify(meta, null, '</br>')` sent as `text/html`. | `server/server.ts:295-309` | — |
| S5 | **Tokens in logs.** `dbConnect.ts:45` logs `{ query, values, err }`; for `createUser`/`updateUser` (`api/users.ts:84-89`) `values` *is* the OAuth token array. `api/users.ts:185` logs the whole `DiscordBotUser`. | | Access + refresh tokens to stdout on any insert failure. |
| S6 | **Token in a user-visible error.** `throw new Error('... ' + JSON.stringify({ name, token: user.nexus_access }))` — thrown from a constructor on every `getUserByDiscordId`, and `err.message` is rendered into a Discord embed by `unexpectedErrorEmbed`. | `api/DiscordBotUser.ts:87`, `api/util.ts:199` | Access token shown in Discord. |
| S7 | Cookies `clientState` and `ErrorDetail` set without `httpOnly`, `secure` or `sameSite`. Signed, not encrypted. `COOKIE_SECRET` is absent from `.env` — if undefined, `res.cookie(..., {signed:true})` throws at runtime rather than failing at boot. | `server/server.ts:46,158,191,275,305,349` | |
| S8 | No `helmet`, no CORS policy, no CSRF, no rate limiting anywhere. OAuth state compared with `!=` (loose, non-constant-time). | `server/server.ts:170,203` | |
| S9 | OAuth tokens stored in plaintext columns; `getAllUsers` does `SELECT *`, pulling every user's tokens into memory. | `types/users.ts:12-17`, `api/users.ts:10` | Encryption at rest is a Phase 3 item, but worth noting now. |

#### Crash / correctness

| # | Issue | Location |
|---|---|---|
| B1 | `||` where `&&` is meant, so the condition is always true: **any failure to reply to a failed interaction calls `process.exit(1)`** and kills the shard. | `events/interactionCreate.ts:79` |
| B2 | Any `Client#error` calls `process.exit()` — no reconnect, no backoff. | `events/error.ts:9-10` |
| B3 | `updateChannels()` computes `shardChannels` then `return`s **without assigning `this.channels`**. Under sharding the channel list is never refreshed. | `feeds/SubscriptionManager.ts:124-134` |
| B4 | `if (!reloadChannels) await this.updateChannels()` — the parameter named "reload" *suppresses* the reload, and the interval passes `true`. | `feeds/SubscriptionManager.ts:61,151` |
| B5 | `this.channels.find(c => c.channel_id === c.channel_id)` compares an element to itself; always returns `channels[0]`. Force-update hits the wrong channel. | `feeds/SubscriptionManager.ts:250` |
| B6 | News timer guard is inverted — the timer is installed on every shard **except** the one owning the news guild, each then round-tripping via `broadcastEval` every 30 min. (Compare `:33`, which uses the same predicate with the opposite sense.) | `feeds/NewsFeedManager.ts:57-62` vs `:33` |
| B7 | `setApprovedTip` binds `[prompt, approved]` to `SET approved=$1 WHERE prompt=$2` — throws a type error every call. | `api/tips.ts:54-57` |
| B8 | Pagination: `ids.slice(length, 50)` should be `ids.slice(length, length + 50)`. Mods past the first 50 are silently dropped. | `api/queries/v2-modsbymodid.ts:55-60` |
| B9 | `count` is passed as a variable but not declared in the query document, so it is discarded and the server default (20) applies. | `api/queries/v2-latestmods.ts:71-75`, `v2-mods.ts:56-60` |
| B10 | `while (total > stats.length)` with no iteration cap and no empty-page check — infinite request loop if `nodesCount` ever disagrees with the pages returned. | `api/queries/v2-collectionsdownloadtotals.ts:76-86` |
| B11 | API-error `catch` only returns when `errorCount === 1 \|\| errorCount % 60 === 0`; otherwise falls through to `newMods!.nodes` with `newMods` undefined. | `feeds/AutoModManager.ts:158-174` |
| B12 | `clearRuleCache()` calls `this.getRules()` un-awaited; `getRules` throws → unhandled rejection. Four call sites. | `feeds/AutoModManager.ts:127-129` |
| B13 | `POST /update-metadata` has no body parser (`express.json()` is only mounted on `/webhook` and `/automod`), so `req.body.userId` throws. Endpoint always 500s. | `server/server.ts:280-293` |
| B14 | `/nxm` never sends a response when `type` is neither `collection` nor `mod` — connection hangs. | `server/server.ts:387-415` |
| B15 | `/localhost-redirect` reads `req.query['port']` into **both** `port` and `token`. | `server/server.ts:418-419` |
| B16 | `config.ownerID` read where the field is `ownerIDs` — the admin check silently evaluates `undefined`. | `interactions/whois.ts:85`, `user-profile.ts:29` vs `DiscordBot.ts:59` |
| B17 | `if (!ic.size) ic.first()?.update({components:[]})` — if size is 0, `first()` is undefined, so buttons are never cleared on timeout. | `interactions/search.ts:268,375` |
| B18 | `logger.debug()` returns early unless `NODE_ENV === 'testing'`, despite the comment claiming the opposite. ~40 debug calls are dead in dev and prod. | `api/util.ts:75` |
| B19 | `Logger.error`/`warn` accept `...args: any[]` and silently discard them — ~30 call sites pass a third argument expecting it to matter. | `api/util.ts:66-73` |
| B20 | `events/reconnecting.ts` and `events/resume.ts` register listeners for events discord.js v14 never emits (the v14 names are `shardReconnecting` / `shardResume`). Dead since the v14 upgrade. | |
| B21 | `AutoModManager.analyseMod`: `.toLowerCase()` binds only to the last concatenated term, so mod name/summary/description are never lowercased before matching against a lowercased filter. Rules silently miss. | `feeds/AutoModManager.ts:353-371` |

**Also worth knowing:** the entire automod feed is switched off — `AutoModManager.ts:113-116` has the
`setInterval` commented out and logs `'Did not start automod'`. That makes ~330 lines unreachable
(`runAutomod`, `analyseMod`, `analyseURLS`, `checkFilePreview`, `flagsToSlackMessage`,
`flagsToDiscordEmbeds`, …), and `/automod report` always renders an empty report. **Decide whether
automod is coming back before spending effort refactoring it.**

**Estimated effort:** 3–5 days for S1–S8 and B1–B20. Most are one-line fixes.

---

---

## The original audit, in summary

The bot works, and the bones are sound: TypeScript, ESM, discord.js v14, a clean-ish
separation of `interactions` / `events` / `feeds` / `api` / `server`. The problems were not
architectural collapse — they were **accumulated drift**. Four things dominated the audit:

1. ~~**Three unauthenticated HTTP endpoints**, one of which deletes any user's account link
   from a `GET` request, and one of which has an inverted auth check guarding write access
   to the automod rules table.~~ **Closed in 3.17.0**, except `POST /webhook` (S3), which
   is still unauthenticated and still the one exploitable finding.
2. **Copy-paste is the primary design pattern.** Four near-identical `track*` functions, two
   identical halves of `automod.ts`, four files expressing one GraphQL query (two with a
   literal space in the filename), three identical DB pool wrappers, ~18 query files that
   repeat the same five-part skeleton. Roughly 25–30% of `src/` is mechanically derivable
   from the rest. *Partly addressed: the automod duplication and two of the four query
   files went with the automod removal. The rest is Phase 2.*
3. ~~**No safety net.**~~ **Closed in 4.0.0** for tooling: 91 tests under vitest, CI gating
   on typecheck, lint and tests, and a working ESLint config that had never run
   successfully. Still missing: migrations and GraphQL codegen, both Phase 3.
4. **The web layer is 5 KB of CSS lifted from a maintenance page**, 16 EJS files, and an
   Express app welded to shard 0 of the bot process. This is the natural place for the
   React/Next.js front-end, and it can be lifted out almost cleanly. *Unchanged — Phase 4.*

The plan is **incremental**: each phase ships independently. Phases 0 and 1 have shipped.

---

---

## Appendix A — the pattern behind the bugs

Almost every defect in Phase 0 belonged to one of five families. Phases 1 and 2 are the
structural fixes for them — this table is the argument for doing the phases rather than
just the individual fixes.

| Family | Examples | Fixed by |
|---|---|---|
| Copy-paste with an incomplete edit | B5 (`c.channel_id === c.channel_id`), `automod.ts:234` wrong error string, `queryAutoMod` logging "CM client", `trackUser`'s `currentGameSub` | Phase 2.2 / 3.2 dedupe |
| Boolean logic inverted | S1, B4, B6, B18 | Phase 1.4 tests ✓ — the fail-closed and redaction cases now have regression tests that were verified to fail against the original bugs |
| Un-awaited or unguarded async | B12, `SubscriptionManager.ts:68`, `setEventHandler` floating from the constructor | Phase 1.3 taxonomy ✓ + lint rule ✓ — both rules are `error` and the 38 warnings are cleared |
| Untyped boundary | B16 (`config: any`), B9 (undeclared GraphQL variable), `Collection<any,any>` | Phase 2.1 + 3.3 codegen |
| No integration coverage | B7, B8, B10, B13 | Phase 1.4 ✓ for B8; B7, B10 and B13 still have no test, because they need a database or an HTTP fixture |

Adding `@typescript-eslint/no-floating-promises`, `no-misused-promises` and
`no-self-compare` to `eslint.config.mjs` catches three of these five families
**mechanically**. This was the cheapest single action in the document and it shipped in
4.0.0 — the config had never run successfully before then, so nothing in this repository
had ever been linted. The first working run found 173 problems; all 103 errors are fixed,
the 38 async warnings were cleared in Phase 2, and both async rules are now `error`. What
remains is 16 warnings, all of them unused declarations.
