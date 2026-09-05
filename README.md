# discord-bot
Nexus Mods Discord Bot

Writen by: Pickysaurus (Nexus Mods)

This Discord bot features interactions with the Nexus Mods API. Including linking your Discord and Nexus Mods accounts, searching games or mods and subscribing new and updated mods for a particular game.

While you are welcome to take parts of this code for your own projects, please do not run your own instance of this Discord bot. 

## Layout

This is an npm workspace. 5.0.0 moved the bot into `apps/bot` so the Next.js front-end
could sit beside it rather than inside it:

```
apps/bot/     the Discord bot and the current Express auth site
apps/web/     the Next.js front-end (Phase 4, in progress)
```

`apps/web` is a scaffold: one route, nothing ported. Express still serves the live site.
Run it with `npm run dev:web`. Its theme is the Nexus Mods theme layer, declared in
`apps/web/app/globals.css` - Tailwind 4 keeps the design system in CSS rather than a
config file, and nexusmods.com is on Tailwind 4 too, so the tokens are the same shape as
the site's rather than a translation of them.

The root scripts delegate, so `npm test`, `npm run build`, `npm run lint` and the
`db:` and `tokens:` scripts all still work from the repository root and do what they
always did. `npm run lint` covers every workspace from one config.

The runtime Docker image deliberately did **not** move: it still holds `dist/` and
`package.json` directly under `/app`, so `node dist/shards.js` remains correct and
`redeploy.sh` needed no change.

## Running locally

The bot and the auth site are two processes from one build. Start both with:

```
npm install
npm run dev:all
```

This builds once and then starts both, prefixing each process's output. Do **not** run
`npm run dev` and `npm run devWeb` in two terminals: both run `tsup`, which cleans
`dist/` first, so the second build deletes what the first is running from.

The bot always runs sharded, locally as in production - `dist/app.js` is the shard child
and refuses to start on its own. `NODE_ENV=testing` gives two shards; `BOT_SHARD_COUNT=1`
gives one, which is the supported way to run a single gateway connection. There is no
unsharded mode: at 2,418 guilds the bot is never in that state in production, and having
it locally meant local runs took `if (!client.shard)` branches that production does not.

Everything comes from `.env` in the repository root - one file for every workspace. It
is found by walking up from the running code rather than from the working directory, so
it does not matter whether you run `npm start` from the root or from inside `apps/bot`.
(That was not true briefly after the 5.0.0 move, and the bot refused to start.) `HOST`, `PORT`, `DATABASE`,
`DBUSER` and `DBPASS` need to point at a Postgres you can reach; the schema is created
by migrations on first start, so an empty database is fine.

To run the same shape in containers instead, `docker compose up --build` starts the bot,
the auth site and a PostgreSQL 17 matching production. The compose file overrides `HOST`
and `PORT` so the containers reach the database service rather than their own localhost.
