# Deploying

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
