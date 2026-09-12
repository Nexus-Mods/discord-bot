# Signing in to the auth site

**Status: a proposal. Nothing here is built.** Written after 5.0.0, while the Next.js site
was still waiting to deploy, so that the decision and its reasoning exist somewhere other
than a chat log.

The site today holds no session at all. Every page is either public (`/tracking`, `/nxm`),
part of a five-minute OAuth flow (`/linked-role` and the two callbacks), or a machine
endpoint behind a shared secret (`/automod`, `/show-metadata`, `/update-metadata`,
`/webhook`). Adding a login is the first time it will know who is looking at it, and that
is a larger change than it sounds.

---

## What it is for

Two audiences, and they are not the same shape.

**Server managers** would see and change what their own Discord server has configured: the
tracked items in `subscribeditems`, the channels in `subscribedchannels`, and the
per-server settings in `servers` and `server_role_conditions`. Today all of this changes
through slash commands.

**Nexus Mods staff** would manage the `tips` table - the prompts the bot answers with -
including the `approved` flag that decides whether a tip is live.

---

## The decision

**Discord is the primary login. A fresh Nexus authorization is a step-up for staff pages.**

Neither provider can serve both audiences, so the question is which one is load-bearing.

### Why Discord

**The authorisation question is a Discord question.** "May this person change the settings
for guild X?" means "do they hold Manage Server on X?", and only Discord can answer it.
The `guilds` OAuth scope returns the user's guilds each with a `permissions` bitfield,
which is exactly the fact needed. There is no route to it through a Nexus login.

**Every editable value is a Discord id.** `servers` holds `channel_nexus`, `channel_news`,
`role_author` and `game_filter`; `server_role_conditions` holds a `role_id` and a
threshold. A usable settings page renders channel and role pickers, so it needs that
guild's channels and roles from Discord regardless of how the user signed in. Logging in
with Nexus would mean authenticating in one currency and authorising in another.

**The audience arrives from Discord.** Everyone who uses this site got here from a Discord
server, and a server manager need not have a Nexus Mods account at all.

### Why not Nexus as primary

Staff management of `tips` is genuinely a Nexus fact, and if that were the whole feature,
Nexus-primary would be simpler. But it is the smaller audience by orders of magnitude, all
of whom will have linked accounts, and it is the easier case to special-case. The server
managers are the case with no alternative.

### Why the staff check is a step-up rather than a lookup

The `users` table already links a Discord id to a Nexus id and holds tokens for both, so
it is tempting to sign in with Discord and read staff status out of the link.

**Do not.** A stale row or a stale token would become a privilege escalation, and Nexus
permissions change without this database hearing about it. Entering a staff page should
send the user through a fresh Nexus authorization and read the claims from the token that
comes back at that moment.

---

## The authorisation model

Authentication answers *who*. Authorisation answers *what*, and it is re-derived per
request rather than stored in the session.

| Surface | Requires |
|---|---|
| `/tracking` as it exists today | Nothing. Stays public and read-only. |
| A guild's settings and tracked items | A Discord session **and** live `MANAGE_GUILD` on that guild **and** the bot being in that guild |
| `servers.official` | Staff only. Not manager-editable. |
| `/tips` | A Discord session **and** a fresh verified Nexus token carrying the staff claim |

Three rules behind that table:

**Permissions are read live, not stored.** Cache the `GET /users/@me/guilds` response in
the session for a minute or two to stay inside Discord's rate limits, but never persist it.
A manager who is removed should lose access on their next page load, not at logout.

**Never authorise on `servers.server_owner`.** It is in the table and it is tempting. It
goes stale the moment a server changes hands, and it is not what Discord would have
checked.

**Intersect the user's guilds with the bot's.** The `guilds` scope lists servers the *user*
is in, including thousands the bot has never seen. `lib/discordDirectory.ts` already talks
to the Discord REST API with the bot token and can confirm the bot is in a guild; without
that intersection, a manager of any unrelated server could open a settings page for a guild
this bot does not serve.

---

## Shape of the implementation

### Two OAuth flows, not one

The existing link flow requests `role_connections.write identify`. **Do not add `guilds` to
it.** Discord shows a consent screen when the scope set grows, so every existing user would
meet a new prompt in the middle of the bot's core feature.

Discord accepts a different scope set per authorization request, so a separate `/login`
route asking for `identify guilds` leaves `/linked-role` untouched. Same Discord
application, same client id, different request.

### The session

The site is deliberately stateless - 4.3.0 moved the in-flight OAuth state into a sealed
cookie precisely so that nothing is held between requests, which is why one replica is
enough. A session cookie keeps that property.

`packages/core/src/sealedValue.ts` already provides what is needed. `deriveKey` takes a
*purpose* alongside the secret, so a session key is `deriveKey(COOKIE_SECRET, 'session')` -
a distinct key from the link state's, from the same secret, with no new configuration.
`linkState.ts` is the working example of the pattern: seal a payload, enforce an absolute
`exp` on open, treat the cookie's `maxAge` as a client-side courtesy only.

Keep in the session: the Discord user id, display name, avatar, an absolute expiry, and a
short-lived cache of the guilds-with-permissions response. Keep out of it: anything a
request can derive, and any token that does not need to be there.

**The cost of statelessness is revocation.** A sealed cookie cannot be withdrawn
server-side. That is tolerable for a manager session with a short TTL; it is the reason
staff access is re-verified rather than trusted from the cookie.

### Verifying the Nexus token

The phrase to avoid is "decode the JWT". A base64-decoded token is attacker-controlled
input, and trusting one is the most common way an admin panel is taken over.

Verification means all of:

- fetch Nexus Mods' JWKS and verify the RS256 signature against it, with caching and key
  rotation handled - `jose` does this properly
- check `iss`
- check `aud` matches this application's client id
- check `exp` and `nbf`
- check `nonce` matches the one sent on the authorize call, which is what stops a token
  minted for another application or another session being replayed here

Only then read the permissions claim.

**Confirm before building:** whether the permission this needs is actually in the
`id_token`, or whether it requires a userinfo call or an API request. The production scope
is currently `openid email profile` (`packages/auth/src/NexusModsOAuth.ts`), and if the
claim is not in there, the shape of this section changes.

---

## Sharp edges

**This takes over a permission check Discord was making.** Every one of these settings
changes through a slash command today, where Discord decides who may run it. On a website
that enforcement becomes ours. That is the real weight of the feature - not the login, the
authorisation - and getting it wrong is silent rather than loud.

**`role_author` and the role conditions are a privilege-escalation surface.** A manager
configuring "grant role X at one million downloads" is configuring this bot to hand out a
Discord role. Discord's hierarchy rule prevents the worst case, because the bot cannot
assign a role above its own - but:

- reject a role the bot cannot assign at the point of selection, rather than writing a row
  that fails quietly later
- consider rejecting a role above the *acting user's* highest role too. Discord applies
  that rule to manual role assignment and will not apply it to ours

**`subscribedchannels.webhook_token` is a secret in the same row as the settings.** It must
never reach the page, a JSON response, or a log line. Select columns explicitly.

**Everything on the site today is a GET.** The moment anything mutates, it needs CSRF
protection - `SameSite=Lax` on the session cookie plus an Origin check, or a double-submit
token. Next's server actions carry an origin check of their own; hand-rolled route handlers
do not.

**Rate limiting is per-process and in-memory** (`lib/security/rateLimit.ts`). The new login
and callback routes belong in `SENSITIVE_PATHS`. This is also the reason the site still
runs one replica: a second would keep its own counters and double every limit.

**The CSP is still report-only.** A login page is a poor thing to leave under a policy that
reports rather than blocks. Self-hosting the Inter font and flipping `CSP_REPORT_ONLY`
should land before this does, not after.

---

## What would have to be built

Roughly in order:

1. `/login`, `/login/callback`, `/logout` - the Discord flow at the new scope set.
2. Session sealing and opening, alongside `linkState.ts` in `packages/auth`.
3. An authorisation helper: given a session and a guild id, return the user's permissions
   there or refuse - one place, used by every guarded route.
4. Guild and role listing in `lib/discordDirectory.ts` (channels already exist).
5. The manager surface: tracked items, channels, and the `servers` /
   `server_role_conditions` settings, with pickers.
6. `/tips`, behind the Nexus step-up.
7. CSRF, and the new paths added to `SENSITIVE_PATHS`.

Tests worth having from the start, in the style of the existing architecture tests: no
guarded route reachable without a session; no guild-scoped query without a permission
check; `webhook_token` never selected outside the feed code.

---

## Open questions

1. **Does the Nexus `id_token` carry the staff claim**, at the scope this application
   requests? Everything in the step-up section assumes it does.
2. **Which settings are manager-editable?** `official` is clearly not. `game_filter` is
   arguable - it changes what the whole server sees.
3. **Is an audit trail wanted?** Slash commands leave a trace in Discord; a website does
   not. If who-changed-what matters, it is a table and it is cheaper to add now than later.
4. **Does the staff surface need Discord at all?** A Nexus-only `/tips` is possible and
   would skip the step-up. It is only the manager surface that makes Discord unavoidable,
   and if tips ships first the ordering could change the answer.
5. **Read-only first?** A version that only *shows* a server's settings needs the session
   and the permission check but none of the mutation risk - CSRF, role hierarchy, audit -
   and would prove the authorisation model before anything can be broken with it.

Question 5 is the one worth answering first.
