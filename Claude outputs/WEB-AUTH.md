# The server management portal

**Status: planned, not built.** Scope and sequencing agreed October 2026, after 5.0.x had
run in production for a month. Supersedes the original proposal written alongside 5.0.0;
the auth decision it reached is unchanged and is summarised below, with one correction.

The portal lets a Discord server's managers see and change what this bot does in their
server, through a web page rather than a slash command.

---

## What was decided

| | Decision |
|---|---|
| **Scope** | Feeds **and** per-server settings. Not the Nexus Mods staff surface. |
| **First release** | **Read-only.** Login, permission check, and a view of what exists. Mutation is release 2. |
| **Slash commands** | **Kept indefinitely.** The portal is an alternative, not a replacement. |
| **Login** | Discord. |

**Nexus Mods staff management of `tips` is out of scope**, and with it the Nexus OAuth
step-up and the JWKS verification that goes with it. That work is still wanted; it is a
separate release and a separate auth path, and keeping it out means this one ships with a
single way to sign in. The reasoning for it is preserved at the end.

### Why Discord is the login

The authorisation question is a Discord question. "May this person change this server's
feeds?" means "do they hold the right Discord permission in that guild?", which only
Discord can answer - the `guilds` OAuth scope returns the user's guilds each with a
`permissions` bitfield. Every editable value is a Discord id as well: `servers` holds
`channel_nexus`, `channel_news`, `role_author` and `game_filter`, and
`server_role_conditions` holds a `role_id`. A settings page renders channel and role
pickers, so it needs that guild's channels and roles from Discord however the user signed
in. And everyone who uses this site arrived from a Discord server; a server manager need
not have a Nexus Mods account at all.

---

## The permission model

**This is the correction to the original proposal**, which assumed `ManageGuild`
throughout. The commands do not agree with each other, and the portal has to match them
rather than invent a rule:

| Surface | Command today | Permission | Enforced by |
|---|---|---|---|
| Feeds - add, edit, remove | `/track`, `/untrack` | `ManageChannels` | **Discord only.** `setDefaultMemberPermissions`, no server-side check. |
| Server settings | `/settings` | `ManageGuild` | `requiredPermissions` in `interactionCreate.ts`, with an owner bypass |
| The public tracking page | - | none | It is public and read-only. Unchanged. |

Two consequences worth stating plainly.

**Gating feeds on `ManageGuild` would be stricter than today** and would lock out people
who can manage feeds right now. Feeds get `ManageChannels`.

**The portal is the first place we enforce the feed permission ourselves.** `/track` leans
entirely on Discord refusing to dispatch the interaction. A website has no such gate, so
this check is new code rather than a port of existing code - which makes it the part most
worth testing.

### The rules

**Permissions are read live, never stored.** Cache the `GET /users/@me/guilds` response in
the session for a minute or two to stay inside Discord's rate limits, and no longer. A
manager who loses access should lose it on their next page load.

**Never authorise on `servers.server_owner`.** It is in the table and it is tempting. It
goes stale the moment a server changes hands, and it is not what Discord would check.

**Intersect the user's guilds with the bot's.** The `guilds` scope lists servers the
*user* is in, including thousands this bot has never seen. `lib/discordDirectory.ts`
already talks to Discord's REST API with the bot token and can confirm the bot is present.

**Mirror the owner bypass.** `interactionCreate.ts` lets a guild owner through regardless.
Diverging from that would be a surprise.

---

## Release 1 - read-only

The point of shipping this half on its own is that it exercises the entire authorisation
model while nothing can be damaged by getting it wrong. If the permission check is too
loose, someone sees a list of feeds they should not have seen. In release 2 the same bug
deletes them.

**1. The Discord login.** `/login`, `/login/callback`, `/logout`.

Request `identify guilds`. **Do not add `guilds` to the existing link flow**, which
requests `role_connections.write identify` - Discord shows a fresh consent screen when the
scope set grows, and that would put a new prompt in the middle of account linking, the
bot's core feature. Discord accepts a different scope set per authorization request, so a
separate route leaves `/linked-role` untouched. Same application, same client id.

**2. The session.** Sealed cookie, no server-side state.

`packages/core/src/sealedValue.ts` already has what is needed: `deriveKey` takes a
*purpose* alongside the secret, so the session key is
`deriveKey(COOKIE_SECRET, 'session')` - a distinct key from the link state's, from the
same secret, with no new configuration. `packages/auth/src/linkState.ts` is the working
example: seal a payload, enforce an absolute `exp` on open, treat the cookie's `maxAge` as
a client-side courtesy.

In the session: Discord user id, display name, avatar, absolute expiry, and a short-lived
cache of the guilds-with-permissions response. Nothing else.

The cost of statelessness is that a session cannot be revoked server-side. That is
tolerable for a manager session with a short TTL, and it is the reason the staff surface
was always going to re-verify rather than trust a cookie.

**3. One authorisation helper.** Given a session, a guild id and a required permission
flag, return the user's permissions there or refuse. One function, used by every guarded
route and every page. If there are two of these, one of them is wrong.

**4. `getServerById` in `packages/persistence`.**

`getServer(guild: Guild)` takes a discord.js `Guild` and, when the row is missing, inserts
it - calling `guild.fetchOwner()` to do so. The web app has no `Guild` objects and must
not acquire discord.js (an architecture test forbids it reaching outside `apps/bot`), and
a read-only page must not be inserting rows as a side effect of being viewed.

So: a sibling accessor taking a snowflake, doing a plain `SELECT`, returning `undefined`
when there is no row. The type-only `import type { Guild }` in that file is fine and stays.

**5. Roles in `lib/discordDirectory.ts`.** `guild(id)` and `channels(guildId)` exist;
roles do not. Needed for rendering `role_author` and the role conditions, even read-only,
because a raw snowflake is not an answer to "which role is this".

**6. The pages.** Guild picker, then per guild: settings as they stand, the channels with
feeds, and the items in each. `lib/tracking.ts` already assembles most of this shape for
the public page.

**7. The new paths join `SENSITIVE_PATHS`** in `lib/security/rateLimit.ts`.

### What already exists

Worth knowing before estimating: the feed read path needs no new persistence at all.
`getSubscribedChannelsForGuild(guildId)`, `getSubscriptionsByChannel(guildId, channelId)`
and `totalItemsInGuild(guildId)` are all keyed on snowflakes and are directly callable
from `apps/web` today. Only the servers accessor needs a sibling.

---

## Release 2 - mutation

Everything below applies only once the portal can write. None of it is needed for
release 1, which is the argument for the split.

**CSRF.** Everything on the site today is a GET. The moment anything mutates it needs
`SameSite=Lax` plus an Origin check, or a double-submit token. Next's server actions carry
an origin check of their own; hand-rolled route handlers do not.

**Webhook creation.** `/track` creates a webhook in the target channel and stores its
token in `subscribedchannels`. Creating a feed from the web means the web app creating
webhooks with the bot token - the most privileged thing the site would do. Worth deciding
whether the portal creates them directly, or only attaches feeds to channels that already
have one, with creation left to `/track`.

**`subscribedchannels.webhook_token` is a secret in the same row as the settings.** It
must never reach the page, a JSON response, or a log line, in either release. Select
columns explicitly rather than `SELECT *`.

**Role hierarchy.** `role_author` and the role conditions configure this bot to hand out a
Discord role. Discord's hierarchy rule prevents the worst case - the bot cannot assign a
role above its own - but reject a role the bot cannot assign at the point of selection
rather than writing a row that fails quietly later. Consider also rejecting a role above
the acting user's highest role, which Discord applies to manual assignment and will not
apply to ours.

**`servers.official` is not manager-editable.** It is a staff flag.

**Concurrent edits.** The portal and the slash commands write through the same persistence
layer, so they cannot drift - but neither takes a lock. Two people editing one feed, or
one person on the web and another in Discord, is last-write-wins. Probably acceptable at
this scale; worth being a decision rather than an accident.

---

## Sharp edges

**Per-guild command permission overrides.** Server admins can reassign `/track` to an
arbitrary role in Integrations settings. A portal checking `ManageChannels` will disagree
with however a guild has configured it. Discord exposes command permissions through an API,
so honouring them is *possible* - but it is a per-guild fetch on every check and a
meaningful amount of work. Recommendation: do not honour them, and say so in the UI.

**The CSP is still report-only.** `CSP_REPORT_ONLY = true` in `lib/security/headers.ts`,
because the Inter font is loaded from Google. A login page is a poor thing to leave under
a policy that reports rather than blocks. Self-hosting the font and flipping that flag
should land *before* this, not after.

**Rate limiting is per process and in memory**, and the site runs one replica for that
reason. That constraint tightens with a login: a second replica would keep its own
counters and double every limit, on the paths where it matters most.

**Migrations still run in the bot container only.** Anything here that needs a schema
change needs the bot to deploy, not just the site. See `DEPLOYING.md`.

---

## Tests worth having from the start

In the style of the existing architecture tests, which have caught more here than the unit
tests have:

- no guarded route is reachable without a session
- no guild-scoped query runs without a permission check
- `webhook_token` is never selected outside the feed code
- `apps/web` still does not import `discord.js`
- the feed permission matches `/track`'s, and the settings permission matches
  `/settings`', read from the command definitions rather than duplicated as constants

That last one is the one that keeps the portal and the commands honest as either changes.

---

## Open questions

1. **Webhook creation in release 2** - does the portal create them, or only attach to
   channels that already have one?
2. **An audit trail?** Slash commands leave a trace in Discord; a website does not. If
   who-changed-what matters, it is one table and it is much cheaper to add before release 2
   than after.
3. **Does release 1 need a guild picker at all**, or does it link straight from Discord?
   A picker means listing the user's guilds, which is the most rate-limit-sensitive call.

---

## Deferred: the Nexus Mods staff surface

Kept because the reasoning still holds and the work is still wanted.

Managing `tips` is a Nexus Mods permission question, not a Discord one. The intended shape
was a **step-up**: sign in with Discord as everyone does, then send the user through a
fresh Nexus Mods authorization on entering the staff pages and read the claims from the
token that comes back at that moment.

**Not** a lookup against the link table. The `users` table already pairs a Discord id with
a Nexus id and holds tokens for both, and reading staff status out of it would mean a stale
row or a stale token becoming a privilege escalation, with Nexus permissions changing
without this database hearing about it.

**Verify the token, do not decode it.** A base64-decoded JWT is attacker-controlled input,
and trusting one is the most common way an admin panel is taken over. Verification means:
fetch Nexus Mods' JWKS and check the RS256 signature with rotation handled (`jose` does
this properly), check `iss`, check `aud` against this application's client id, check `exp`
and `nbf`, and check `nonce` against the one sent on the authorize call. Only then read the
permissions claim.

**Confirm before building:** whether the permission is in the `id_token` at all, or needs a
userinfo call. Production requests `openid email profile`
(`packages/auth/src/NexusModsOAuth.ts`), and if the claim is not in there the shape of this
changes.
