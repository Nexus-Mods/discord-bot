import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit takes its connection from .env, and .env in this repo holds the
 * deployed server's credentials. `drizzle-kit push` rewrites whatever schema it
 * reaches - it drops columns and tables that are not in schema.ts - so a bare
 * `npx drizzle-kit push` while .env points at a live database is a way to lose
 * production data from a single mistyped command.
 *
 * Two rails:
 *   DRIZZLE_DB_URL   overrides the connection entirely, for local work.
 *   DRIZZLE_ALLOW_REMOTE=true  is required before push will touch a non-local host.
 *
 * Deploys are unaffected: the bot migrates through src/db/migrate.ts, which does
 * not read this file. Nothing here runs in production.
 */
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', 'host.docker.internal'];

const url = process.env.DRIZZLE_DB_URL;

function targetHost(): string {
    if (!url) return process.env.HOST ?? 'localhost';
    try {
        return new URL(url).hostname;
    }
    catch {
        throw new Error('DRIZZLE_DB_URL is not a valid connection URL.');
    }
}

const host = targetHost();
const isLocal = LOCAL_HOSTS.includes(host);
const command = process.argv[2];

// Only guard the commands that write. generate and check never open a connection.
if (['push', 'drop'].includes(command ?? '') && !isLocal && process.env.DRIZZLE_ALLOW_REMOTE !== 'true') {
    throw new Error(
        `Refusing to \`drizzle-kit ${command}\` against a non-local host (${host}).\n\n` +
        'push rewrites the schema in place and drops anything not in schema.ts.\n' +
        'To target a local database instead, set DRIZZLE_DB_URL, e.g.\n' +
        '  DRIZZLE_DB_URL=postgres://user:pass@localhost:5432/DiscordBot npx drizzle-kit push\n\n' +
        'If you really do mean this host, set DRIZZLE_ALLOW_REMOTE=true as well.\n' +
        'Note that deployments do not need this: the bot applies migrations itself,\n' +
        'through src/db/migrate.ts, and never uses push.'
    );
}

export default defineConfig({
    dialect: 'postgresql',
    schema: './src/db/schema.ts',
    out: './drizzle',
    dbCredentials: url
        ? { url }
        : {
            host: process.env.HOST ?? 'localhost',
            port: process.env.PORT ? parseInt(process.env.PORT) : 5432,
            user: process.env.DBUSER,
            password: process.env.DBPASS,
            database: process.env.DATABASE ?? 'discord_bot',
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        },
    // Keep generated SQL close to how the schema was dumped.
    casing: 'snake_case',
});
