# discord-bot
Nexus Mods Discord Bot

Writen by: Pickysaurus (Nexus Mods)

This Discord bot features interactions with the Nexus Mods API. Including linking your Discord and Nexus Mods accounts, searching games or mods and subscribing new and updated mods for a particular game.

While you are welcome to take parts of this code for your own projects, please do not run your own instance of this Discord bot. 

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

Everything comes from `.env` in the repository root. `HOST`, `PORT`, `DATABASE`,
`DBUSER` and `DBPASS` need to point at a Postgres you can reach; the schema is created
by migrations on first start, so an empty database is fine.

To run the same shape in containers instead, `docker compose up --build` starts the bot,
the auth site and a PostgreSQL 17 matching production. The compose file overrides `HOST`
and `PORT` so the containers reach the database service rather than their own localhost.
