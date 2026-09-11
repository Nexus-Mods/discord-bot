# discord-bot
Nexus Mods Discord Bot

Writen by: Pickysaurus (Nexus Mods)

This Discord bot features interactions with the Nexus Mods API. Including linking your Discord and Nexus Mods accounts, searching games or mods and subscribing new and updated mods for a particular game.

While you are welcome to take parts of this code for your own projects, please do not run your own instance of this Discord bot. 

## Layout

This is an npm workspace. 5.0.0 moved the bot into `apps/bot` so the Next.js front-end
could sit beside it rather than inside it, and split what both of them use into packages:

```
apps/bot/          the Discord bot, and the Express auth site it still carries
apps/web/          the Next.js front-end
packages/core/     logging, errors, formatting, env and the sealed-value format
packages/auth/     the two OAuth clients, URL and cookie signing, link state
packages/nexus-api/  the Nexus Mods GraphQL client and its generated types
packages/persistence/  the schema and every query
packages/account/  the linked-account model
```

The front-end is complete: every route Express serves has a counterpart, and
`apps/web/tests/routeParity.test.ts` checks that by reading the route table out of
`server.ts`. Express is still what the deployment runs, deliberately — it is what the new
site is compared against, and the way back if the switch misbehaves. `DEPLOYING.md` has
the switch and its rollback.

Its theme is the Nexus Mods theme layer, declared in `apps/web/app/globals.css` - Tailwind
4 keeps the design system in CSS rather than a config file, and nexusmods.com is on
Tailwind 4 too, so the tokens are the same shape as the site's rather than a translation
of them.

The root scripts delegate, so `npm test`, `npm run build`, `npm run lint` and the
`db:` and `tokens:` scripts all still work from the repository root and do what they
always did. `npm run lint` covers every workspace from one config. `npm run build` builds
the packages first — both applications need their `dist/`, because the packages' exports
map answers the runtime condition from there.

There are two images. The bot's runtime image deliberately did **not** move: it still
holds `dist/` and `package.json` directly under `/app`, so `node dist/shards.js` remains
correct. The front-end has its own, built from Next's standalone output so it carries only
the modules its server loads rather than the whole workspace's `node_modules`. CI builds
both from the same commit and tags them with the same sha.

## Running locally

The bot and an auth site are two processes from one build. Start both with:

```
npm install
npm run dev:all      # the bot and Express
npm run dev:next     # the bot and the Next front-end
```

Either builds once and then starts both, prefixing each process's output. They are
alternatives, not a pair: both serve the same paths on port 3000, so whichever is running
answers `http://localhost:3000` and the redirect URIs registered with Discord and Nexus
Mods work for both. That is what makes them comparable, and it is why the ported routes
kept Express's paths.

Do **not** run `npm run dev` and `npm run devWeb` in two terminals: both run `tsup`, which
cleans `dist/` first, so the second build deletes what the first is running from.

The bot always runs sharded, locally as in production - `dist/app.js` is the shard child
and refuses to start on its own. `NODE_ENV=testing` gives two shards; `BOT_SHARD_COUNT=1`
gives one, which is the supported way to run a single gateway connection. There is no
unsharded mode: at 2,418 guilds the bot is never in that state in production, and having
it locally meant local runs took `if (!client.shard)` branches that production does not.

Everything comes from `.env` in the repository root - one file for every workspace. It
is found by walking up from the running code rather than from the working directory, so
it does not matter whether you run `npm start` from the root or from inside `apps/bot`.
(That was not true briefly after the 5.0.0 move, and the bot refused to start.) `HOST`,
`DBPORT`, `DATABASE`, `DBUSER` and `DBPASS` need to point at a Postgres you can reach; the
schema is created by migrations on first start, so an empty database is fine.

**`DBPORT`, not `PORT`.** The database port is `DBPORT ?? PORT`, and the Next server reads
`PORT` to decide what to listen on - so in the front-end those two names mean different
things, and it refuses to start without `DBPORT` rather than quietly pointing its database
client at an HTTP port. The bot has always been happy with `PORT=5432`; setting `DBPORT`
as well changes nothing for it.

To run the same shape in containers instead, `docker compose up --build` starts the bot,
the auth site and a PostgreSQL 17 matching production. The compose file overrides `HOST`
and `PORT` so the containers reach the database service rather than their own localhost.
It still runs Express, matching what the deployment runs today.
