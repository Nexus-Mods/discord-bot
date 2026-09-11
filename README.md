# discord-bot
Nexus Mods Discord Bot

Writen by: Pickysaurus (Nexus Mods)

This Discord bot features interactions with the Nexus Mods API. Including linking your Discord and Nexus Mods accounts, searching games or mods and subscribing new and updated mods for a particular game.

While you are welcome to take parts of this code for your own projects, please do not run your own instance of this Discord bot. 

## Layout

This is an npm workspace. 5.0.0 finished the split: the Discord bot and the auth site are
two applications, sharing five packages.

```
apps/bot/     the Discord bot - gateway, commands, feeds, migrations
apps/web/     the auth site - a Next.js app (OAuth, tracking, the machine endpoints)

packages/core/         env loading, logging, shared utilities
packages/nexus-api/    the Nexus Mods GraphQL/v2 client
packages/auth/         OAuth state, cookie sealing, link signing
packages/persistence/  the database client and the data access layer
packages/account/      account linking and role assignment
```

Express is gone as of 5.0.0. `apps/web` serves everything the Express site used to; there
is no `dist/web.js` and no second command over the bot's image. The two applications ship
as two Docker images built from the same commit - see `DEPLOYING.md`.

`apps/web`'s theme is the Nexus Mods theme layer, declared in `apps/web/app/globals.css` -
Tailwind 4 keeps the design system in CSS rather than a config file, and nexusmods.com is
on Tailwind 4 too, so the tokens are the same shape as the site's rather than a
translation of them.

The root scripts delegate, so `npm test`, `npm run build`, `npm run typecheck` and the
`db:` and `tokens:` scripts all work from the repository root and do what they always did.
`npm run lint` covers every workspace from one config.

The packages build to `dist/` and are resolved from source for types, so `npm run
typecheck` needs no build - but anything that actually *resolves* a package does. Both
applications' `build` scripts call the root `build:packages` first, so a clean checkout
builds in one step.

## Running locally

**Both together**, from the repository root:

```
npm install
npm run dev:all
```

That builds the packages and the bot once, then starts the sharding manager and `next dev`
together, prefixing each process's output `[bot]` and `[web]`. The site is on
http://localhost:3000. Ctrl+C stops both, and if either exits the other is stopped with it
- half a pair is not a useful state to debug in.

**The site alone**, if you are working on a page and do not need the bot running:

```
npm run dev:web
```

That builds the packages first (`next.config.ts` imports `@nexusmods/core/env.js`, which
resolves to `dist/`) and then starts `next dev` on the same port.

**The bot alone** is `npm start` after a build, or `npm run dev -w @nexusmods/discord-bot`
to do both.

Do **not** run the bot's `dev` and `dev:all` in two terminals: both run `tsup`, which
cleans `dist/` first, so the second build deletes what the first is running from.

The bot always runs sharded, locally as in production - `dist/app.js` is the shard child
and refuses to start on its own. `NODE_ENV=testing` gives two shards; `BOT_SHARD_COUNT=1`
gives one, which is the supported way to run a single gateway connection. There is no
unsharded mode: at 2,418 guilds the bot is never in that state in production, and having
it locally meant local runs took `if (!client.shard)` branches that production does not.

Everything comes from `.env` in the repository root - one file for every workspace. It
is found by walking up from the running code rather than from the working directory, so
it does not matter whether you run `npm start` from the root or from inside `apps/bot`.
`HOST`, `DATABASE`, `DBUSER`, `DBPASS` and `DBPORT` need to point at a Postgres you can
reach; the schema is created by migrations on first start, so an empty database is fine.

**Set `DBPORT` explicitly.** The database port falls back to `PORT` when `DBPORT` is
unset, and `PORT` is what the Next server listens on - so leaving it out points the
database client at the web port. `.env.example` carries both.

Migrations run in the bot process only. Starting just the site against a fresh database
will not create the schema; run the bot once, or `npm run db:migrate`.

To run the same shape in containers instead, `docker compose up --build` starts the bot,
the site and a PostgreSQL 17 matching production.
