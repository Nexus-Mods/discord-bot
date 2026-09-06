# @nexusmods/account

`DiscordBotUser` and the repository that returns them. A linked account: the row, the two
sets of OAuth tokens, and everything either service can be asked about the person holding
it.

The plan listed this as its own cut and it is the last one. Step 8 forced it: the two
admin metadata endpoints call `getUserByDiscordId`, and an endpoint in apps/web cannot
reach into apps/bot.

## What it took

One import. `DiscordBotUser` built its Nexus Mods request headers from `baseheader`, which
carried `Application-Version` from the *bot's* package.json - and a package that walks up
for a manifest finds its own. `baseheader` is `@nexusmods/nexus-api/headers.js` now and
reports that package's version, which is the same string because every workspace here is
released together. An architecture test keeps it that way; if it ever fails, this header
is one of the things it is failing about.

## Not a repository yet

`users.ts` is called a repository above and is really a set of functions over a pool. It
returns `DiscordBotUser` instances, which is why it belongs here rather than in
`@nexusmods/persistence` - a data layer that constructs the account model is a data layer
that knows about OAuth. Turning it into something injectable is a redesign; this is a move.
