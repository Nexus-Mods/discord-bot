# Nexus Mods Discord Bot — Modernisation & Simplification Plan

**Status:** Phase 0 shipped in **3.17.0**. Phases 1–5 are still proposals.
**Date:** 28 August 2026 (audited at `473db19`)
**Scope:** `nexus-bot-typescript` — 89 TypeScript files, ~12,600 lines at time of audit.

---

## Status as of 3.17.0

**Done.** Eight of the nine security findings, and all 21 correctness defects
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
| 44 `no-floating-promises` / `no-misused-promises` warnings | Phase 2. `npm run lint:strict` reports them as errors to track the count down. |
| Query modules still return `[]` on failure | The ~18 v2 query files swallow errors and return an empty result, so callers cannot tell "no results" from "the API is down". Fixing this changes feed behaviour (a transient API error would propagate instead of being a silent no-op cycle), so it belongs with the Phase 3 data-layer contract work rather than being slipped into 1.3. |
| No `.gitattributes` | `core.autocrlf` is set locally in one clone only; teammates still see a phantom 17,000-line diff. Phase 1.1. |

**Nothing here has been run against a live Discord gateway or database.** The HTTP
middleware chain and the unlink signing were verified in isolation; the OAuth round
trip, the subscription feed and the news feed have not been exercised end to end.

---

## Executive summary

The bot works, and the bones are sound: TypeScript, ESM, discord.js v14, a clean-ish
separation of `interactions` / `events` / `feeds` / `api` / `server`. The problems are not
architectural collapse — they are **accumulated drift**. Four things dominate:

1. **Three unauthenticated HTTP endpoints**, one of which deletes any user's account link
   from a `GET` request, and one of which has an inverted auth check guarding write access
   to the automod rules table. These are not refactor items; they are today's problems.
2. **Copy-paste is the primary design pattern.** Four near-identical `track*` functions, two
   identical halves of `automod.ts`, four files expressing one GraphQL query (two with a
   literal space in the filename), three identical DB pool wrappers, ~18 query files that
   repeat the same five-part skeleton. Roughly 25–30% of `src/` is mechanically derivable
   from the rest.
3. **No safety net.** `"test": "echo \"Error: no test specified\" && exit 1"`. No migrations
   table. No GraphQL codegen. Nothing catches the class of bug listed in Appendix A —
   which is why there are so many of them.
4. **The web layer is 5 KB of CSS lifted from a maintenance page**, 16 EJS files, and an
   Express app welded to shard 0 of the bot process. This is the natural place for the
   React/Next.js front-end, and it can be lifted out almost cleanly.

The plan below is **incremental**: each phase ships independently, and Phase 0 is
deployable this week.

---

## Phase 0 — Stop the bleeding (days, not weeks)

These are live defects, not modernisation. Ordered by blast radius.

### Security

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

### Crash / correctness

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

## Phase 1 — Foundations (1–2 weeks)

Nothing else is safe until there is a way to know something broke.

### 1.1 Build pipeline

The current build is `clean.cjs` → `tsc` → `add-js-extensions.cjs` → three `copyfiles`
invocations. `add-js-extensions.cjs` regex-rewrites every quoted relative path in `dist/`
to append `.js`, because `moduleResolution: "node"` is paired with ESM output.

- Set `"moduleResolution": "bundler"` (or `"nodenext"` with explicit `.js` specifiers in
  source) and **delete `add-js-extensions.cjs` and `clean.cjs`** — 2 files, ~90 lines of
  homegrown post-processing gone.
- Better: replace `tsc` emit with **tsup** or **esbuild**. Build drops from seconds to
  milliseconds and the asset copy becomes one config line.
- Fix the `copy-assets` globs: `copyfiles -f` flattens and the globs are single-level
  (`./src/server/views/*`), so any new subdirectory is silently dropped from `dist`.
  *(Moot once the web layer moves — see Phase 4.)*
- Remove `path` from dependencies — it is a deprecated userland shim for the Node builtin.
- Remove `jsonwebtoken` and `@types/jsonwebtoken` — zero references in `src/`.
- Move `@types/*` from `dependencies` to `devDependencies` (8 packages currently misplaced).
- `build.sh` installs `@discordjs/uws@^10.149.0` and `request@^2.34` and runs a non-existent
  `index.js`. It is a fossil from the pre-TypeScript bot. Delete it.

### 1.2 Logging

Replace the hand-rolled 36-line `Logger` (`api/util.ts:44-79`) with **pino**:

- Structured JSON in production, `pino-pretty` in dev.
- Real levels — fixes B18 and B19 by construction.
- **Redaction paths** for `values`, `nexus_access`, `nexus_refresh`, `discord_access`,
  `discord_refresh` — fixes S5 without hunting call sites.
- Child loggers carry the shard ID, so `setShardId` and the module-level mutable logger
  singleton (`DiscordBot.ts:10-11`) both disappear.
- Keeps the existing `logger.info(msg, data)` call shape if you use `pino`'s
  `(obj, msg)` order via a thin adapter — or do a mechanical swap, it is ~400 call sites
  and a codemod handles it.
- Sweep the 20 remaining raw `console.*` calls (11 in `api/`, 5 in `shards.ts`, 3 in
  `interactions/`, 1 in `server/`), including the stray debug at `api/util.ts:237`.

### 1.3 Errors

Today there are **five** mutually incompatible conventions in the data layer alone:
swallow-and-return-empty; mutate-the-caught-error-and-rethrow; `Promise.reject` with a
string or a bare `false`; wrap-in-a-generic-`Error`-discarding-the-cause; and
`handleDatabaseError` which is **typed to return `string`** so `throw handleDatabaseError(err)`
throws a bare string with no stack (`api/dbConnect.ts:46,99`).

- One error taxonomy: `AppError` with `cause` (ES2022), a `code`, and `isOperational`.
  `NexusApiError`, `DatabaseError`, `UserFacingError` extend it.
- Always throw `Error` subclasses, never strings, never booleans.
- Callers must be able to distinguish "no results" from "the API is down" — currently they
  cannot, because ~18 query files return `[]` on failure.
- Delete the ~6 `catch(err) { throw err }` no-ops.

### 1.4 Tests

Add **vitest**. The single biggest obstacle is that `api/dbConnect.ts:3` and
`api/queries/other.ts:4` import `logger` from `../DiscordBot`, so **the data layer cannot be
imported without booting the Discord client module.** Break that import first (inject the
logger, or move it to its own module) — it is a two-line change that unlocks everything else.

Start narrow and high-value:
- `types/subscriptions.ts` embed builders (731 lines, pure functions, zero I/O).
- `api/util.ts` parsing helpers.
- The GraphQL query modules against recorded fixtures — this catches B8/B9/B10.
- A smoke test that imports every file in `interactions/` and asserts the exported shape.

### 1.5 CI

`.github/workflows/docker-build.yaml` builds and pushes on every `master` push with **no
lint, no typecheck, no test, and no version tag** (`tags: nexusmods/discord-bot:latest` only).

- Add a `checks` job: `npm run typecheck`, `npm run lint`, `vitest run` — required before
  `docker`. The first two pass cleanly as of 3.17.0, so this can land immediately.
- Tag images with the git SHA as well as `latest` so a rollback is possible.
- Pin `joelwmale/webhook-action@master` to a SHA.

---

## Phase 2 — Simplify the bot core (2–3 weeks)

### 2.1 A real command contract

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

### 2.2 Kill the duplication

| Target | Current | Proposed |
|---|---|---|
| `interactions/track.ts` | 461 lines, four functions (`trackGame`/`trackMod`/`trackCollection`/`trackUser`) sharing an identical skeleton — including the same copy-pasted quota block with the same dead commented line, and the variable named `currentGameSub` in all four | One generic `track(kind, …)` driven by a per-kind descriptor. ~150 lines. |
| `interactions/automod.ts` | 428 lines; `listRules`/`listFileRules`, `addRule`/`addFileRule`, `removeRule`/`removeFileRule` are byte-for-byte identical apart from field names (and the same copy-pasted error string — `:234` says "Adding rules" inside `removeRule`) | One parameterised set. ~200 lines. |
| `interactions/search.ts` | 639 lines, 14 `EmbedBuilder` sites; `searchMods` (:278-387) and `searchCollections` (:164-276) are the same ~110-line function | Split into `search/` with a shared result-renderer. |
| Embeds | 56 `new EmbedBuilder` sites; brand colour `0xda8e35` hardcoded **31 times**; footer `'Nexus Mods API link'` 10 times; `client.user?.avatarURL() \|\| ''` ~20 times; `notAllowed()` and `botUser()` duplicated verbatim between `whois.ts` and `user-profile.ts` | A `lib/embeds.ts` with `nexusEmbed(client)` returning a pre-branded builder. |
| Pagination / collectors | Hand-rolled **7 times** with no shared helper (`search.ts` ×2, `settings.ts`, `tips-manager.ts` ×3, `untrack.ts`), timeouts ranging 30 s to **3,600,000 ms** (`untrack.ts:66`), two of them non-functional (B17) | One `paginate()` helper with a standard timeout and correct teardown. |

### 2.3 Modernise discord.js usage

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

### 2.4 State

- Fold the `ClientExt` grab-bag (`gamesList`, `tipCache`, `newsFeed`, `automod`,
  `subscriptions`, `interactions`, `commands`, `config: any`) into a typed **service
  container** passed into the command context. `config: any` is why `whois.ts:85` reads
  `config.ownerID` while the real field is `ownerIDs` (B16) — a typed container makes that a
  compile error.
- `client.gamesList` is initialised **twice** (`DiscordBot.ts:79` and `clientReady.ts:22`).
- `TipCache` fires an un-awaited `getAllTips()` in its constructor and is lazily constructed
  in four places with `if (!client.tipCache) client.tipCache = new TipCache()` — a race under
  concurrent commands.
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

### 2.5 Split the giants

`SubscriptionManager.getUpdatesForChannel` (124 lines, six responsibilities),
`getGameUpdates` (107 lines — two near-identical halves), `getUserUpdates` (118 lines —
a third copy of the same shape plus 36 lines of commented code),
`DiscordBot.setInteractions` (105 lines doing four jobs),
`claimrole.ts::action` (112 lines with a hand-rolled AND/OR evaluator),
`AutoModManager.analyseMod` (65 lines, four concerns).

---

## Phase 3 — Data layer (2–3 weeks)

### 3.1 Migrations

There is no migration system. `api/migrations.ts` holds two ad-hoc functions gated on
`process.env.npm_package_version === '3.13.0' / '3.13.1'` (`shards.ts:20-23`) — current
version is **3.16.5**, so neither can ever run again, and they only ran under
`dist/shards.js`, never `dist/app.js`. Schema is created lazily by `CREATE TABLE IF NOT EXISTS`
scattered through the data layer (`api/subscriptions.ts:301-341`, `api/news.ts:37-55`), and
the tables `users`, `servers`, `tips`, `automod_rules`, `automod_badfiles`,
`server_role_conditions` **have no creation code in the repo at all** — the schema exists
only in production.

Adopt **drizzle-kit** or **node-pg-migrate**:
1. Introspect production into an initial baseline migration.
2. Delete `api/migrations.ts` and the `ensureXDB()` calls.
3. Run migrations from one entrypoint, before the client connects.

This is the single highest-value item in Phase 3 — the schema is currently undocumented and
unreproducible.

### 3.2 Query layer

- Collapse `queryPromise` / `queryCommunityMap` / `queryAutoMod` (`dbConnect.ts:30,53,76` —
  22 identical lines each) into one pool-parameterised function. Note `queryAutoMod` still
  logs `'Error acquiring CM client'`.
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

**A note on ORMs:** the SQL here is simple and mostly parameterised. Drizzle would give you
typed rows and migrations from one tool, which is attractive. Kysely gives typed SQL with
less magic. Either is defensible; staying on raw `pg` with a migration tool bolted on is
also defensible. What is *not* defensible is having no migrations.

### 3.3 GraphQL

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

- `v2-latestmods automod.ts` is **byte-identical** to `v2-latestmods.ts` except the function
  name. `v2-updatedMods automod.ts` differs from `v2-updatedMods.ts` by the function name
  and four lines (`mirrors { name uri }`). And `v2-latestmods.ts` / `v2-updatedMods.ts` are
  themselves ~85% the same file. **Four files express one query.**
- **Two of those filenames contain a literal space**, which survives the build only because
  `add-js-extensions.cjs` rewrites the specifier. Rename them regardless of anything else
  in this plan.
- Instantiate a single `GraphQLClient` — currently the *function* form of
  `graphql-request` is used at ~18 call sites, so there is no shared timeout, no middleware,
  no connection reuse.
- Add **retry with backoff and `Retry-After` handling**. A repo-wide grep for
  `retry|backoff|rate.limit|429` in `api/` and `feeds/` returns two cosmetic hits. Today a
  Cloudflare block or a 5xx just becomes an empty array.

### 3.4 Auth tokens

- `NexusMods.Auth()` is called from only seven interactive paths. Every other call —
  **including the background feed managers** — goes through `headers()`
  (`DiscordBotUser.ts:92-105`), which reads `access_token` without checking `expires_at`.
  Background jobs run on whatever token was loaded from the DB and 401 when it lapses.
  `NexusGQLError` special-cases 401 (`v2.ts:165`) but nothing acts on it.
- No skew window: `NexusModsOAuth.ts:117` refreshes only `if (Date.now() > tokens.expires_at)`,
  so a token expiring mid-request is used and fails. Use a 60 s margin.
- If Nexus omits `refresh_token` from a rotation response, `saveTokens` persists `undefined`
  over the stored one. Guard it.
- `Revoke` (`DiscordBotUser.ts:118`) fires and forgets — the row keeps dead tokens.
- `NexusModsOAuth.ts:135` contains `tokens.access_token = tokens.access_token;`.
- Encrypt tokens at rest (pgcrypto or app-level AES-GCM with a KMS key).

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

## Phase 5 — Sharding and dead code (1 week)

### 5.1 Does this bot need sharding?

Probably not yet, and **the code half-admits it**. Almost every subsystem disables itself on
non-zero shards:

- `DiscordBot.ts:168` — only shard 0 registers commands.
- `SubscriptionManager.ts:53-57` — non-zero shards get no timer.
- `AutoModManager.ts:109-112` — non-zero shards skip setup entirely.
- `server/server.ts:33` — the OAuth site only runs on shard 0.

The effective architecture is **one worker plus N idle gateway connections** — and the
shard-aware branches are where B3, B5 and B6 live. Discord requires sharding at 2,500
guilds; `about.ts:58-62` is the only place that genuinely needs cross-shard data.

Cross-shard communication is `broadcastEval` **string injection** in four places
(`SubscriptionManager.ts:194-196, 217-233`, `NewsFeedManager.ts:83-87`, `about.ts:60`), with
no message protocol — `handleForceUpdate` is a public method reachable only through an eval.

**Recommendation:** confirm the current guild count. If under ~2,000, run a single process
and delete `shards.ts` and every `if (client.shard)` branch — that removes three of the
bugs above for free. If sharding is genuinely needed, replace `broadcastEval` with a typed
IPC message protocol.

Also in `shards.ts`: the version-gated migrations (dead), and `'Shard X died', true`
(`:13`) with a leftover argument.

### 5.2 Dead code inventory

Rows marked ✓ were removed in 3.17.0.

| Item | Location | Lines |
|---|---|---|
| ~~`communitymap` route stubs~~ | `server/CommunityMap.ts` | 139 ✓ |
| ~~Unreachable automod analysis~~ | `feeds/AutoModManager.ts` | ~330 ✓ |
| ~~Events discord.js v14 never emits~~ | renamed to `shardReconnecting` / `shardResume` | 24 ✓ |
| Version-gated migrations for 3.13.0 / 3.13.1 | `api/migrations.ts`, `shards.ts:21-22` | ~60 |
| `add-js-extensions.cjs` + `clean.cjs` | root | ~90 |
| `build.sh` (pre-TypeScript fossil) | root | 6 |
| ~~Duplicate query files with spaces in the names~~ | `api/queries/*automod.ts` | ~190 ✓ |
| Unused types: `PermissionsExt`, `ClientExt.commands`, `DiscordEventInterface.name`, `TrackingState`, `Tag`, `TagCategory`, `CollectionPage` | `types/` | ~50 |
| Unused deps: `jsonwebtoken`, `@types/jsonwebtoken`, `path` | `package.json` | — |
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

## Sequencing and effort

| Phase | Effort | Risk | Ships |
|---|---|---|---|
| 0 — Security + crash bugs | 3–5 days | **Low** | Immediately |
| 1 — Build, logging, errors, tests, CI | 1–2 weeks | Low | Independently |
| 2 — Command framework + dedupe | 2–3 weeks | Medium | Command by command |
| 3 — Migrations, codegen, query layer | 2–3 weeks | Medium | Migrations first, then codegen |
| 4 — Next.js split | 3–4 weeks | Medium | Route group by route group |
| 5 — Sharding decision + dead code | 1 week | Low | Anytime after Phase 1 |

Phases 2 and 3 can run in parallel with different people. Phase 4 depends on Phase 3's
`packages/db`. Phase 5's dead-code sweep can happen any time and makes everything else
smaller.

**Total: roughly 10–14 weeks of one engineer, with value shipping from week one.**

---

## Three decisions needed before starting

1. **Is automod coming back?** It is switched off (`AutoModManager.ts:113-116`), which makes
   ~330 lines unreachable and `/automod report` permanently empty. If it is dead, deleting
   it removes a large chunk of Phase 2 and Phase 5.
2. **What is the current guild count?** It determines whether sharding stays, and that
   decision cascades into Phases 2, 4 and 5.
3. **Monorepo or two repos?** The plan assumes a pnpm workspace so the bot and web app can
   share the schema and the Nexus API client. Two repos means publishing those as packages,
   or duplicating them.

---

## Appendix A — the pattern behind the bugs

Almost every defect in Phase 0 belongs to one of five families, and each family has a
structural fix in a later phase:

| Family | Examples | Fixed by |
|---|---|---|
| Copy-paste with an incomplete edit | B5 (`c.channel_id === c.channel_id`), `automod.ts:234` wrong error string, `queryAutoMod` logging "CM client", `trackUser`'s `currentGameSub` | Phase 2.2 / 3.2 dedupe |
| Boolean logic inverted | S1, B4, B6, B18 | Phase 1.4 tests |
| Un-awaited or unguarded async | B12, `SubscriptionManager.ts:68`, `setEventHandler` floating from the constructor | Phase 1.3 error taxonomy + lint rule |
| Untyped boundary | B16 (`config: any`), B9 (undeclared GraphQL variable), `Collection<any,any>` | Phase 2.1 + 3.3 codegen |
| No integration coverage | B7, B8, B10, B13 | Phase 1.4 |

Adding `@typescript-eslint/no-floating-promises`, `no-misused-promises` and
`no-self-compare` to `eslint.config.mjs` catches three of these five families
**mechanically**, today, before any refactor. That is the cheapest single action in this
document.
