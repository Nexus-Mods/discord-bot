import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const KEYS = ['DATABASE', 'DBPORT', 'PORT', 'DB_SSL', 'DB_SSL_CA', 'NODE_ENV', 'DB_STATEMENT_TIMEOUT_MS', 'AUTOMOD_DATABASE', 'DB_POOL_MAX'];
let saved: Record<string, string | undefined>;

/** dbConnect memoises its config, so each case needs a fresh module instance. */
async function loadConfig() {
    vi.resetModules();
    const mod = await import('../../src/api/dbConnect.js');
    return mod.poolConfig();
}

beforeEach(() => {
    saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
    for (const k of KEYS) delete process.env[k];
    process.env.DATABASE = 'testdb';
});

afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
    }
});

describe('database port', () => {
    // The old code was `process.env.PORT ? parseInt(...) : 0` - port 0 is not a port,
    // it asks the OS for an ephemeral one, and the connection failed far from the cause.
    it('defaults to 5432 rather than 0 when nothing is set', async () => {
        expect((await loadConfig()).port).toBe(5432);
    });

    it('prefers DBPORT', async () => {
        process.env.DBPORT = '6543';
        process.env.PORT = '8080';
        expect((await loadConfig()).port).toBe(6543);
    });

    it('still honours PORT, so existing deployments keep working', async () => {
        process.env.PORT = '5433';
        expect((await loadConfig()).port).toBe(5433);
    });

    it('rejects a non-numeric port instead of passing NaN to pg', async () => {
        process.env.DBPORT = 'not-a-port';
        await expect(loadConfig()).rejects.toThrow(/positive integer/);
    });

    it('rejects a partially-numeric port that parseInt would have truncated', async () => {
        process.env.DBPORT = '5432abc';
        await expect(loadConfig()).rejects.toThrow(/positive integer/);
    });
});

describe('ssl', () => {
    // The NODE_ENV default has to reproduce pre-4.0.0 behaviour exactly: on for
    // 'production' and for unset, off for everything else.
    //
    // These cases are spelled out one value at a time on purpose. The first version of
    // this code checked for 'development' and 'test' - neither of which this repository
    // uses - so every local run went down the TLS path and `npm start` died with "The
    // server does not support SSL connections". The tests passed anyway, because vitest
    // sets NODE_ENV=test and that happened to be one of the invented values. Asserting
    // on the real vocabulary is the point of this block.
    it('encrypts without verifying when NODE_ENV is unset', async () => {
        expect((await loadConfig()).ssl).toEqual({ rejectUnauthorized: false });
    });

    it('encrypts without verifying in production', async () => {
        process.env.NODE_ENV = 'production';
        expect((await loadConfig()).ssl).toEqual({ rejectUnauthorized: false });
    });

    // 'testing' is this repository's local value - see isTesting in api/util.ts,
    // shards.ts and NexusModsOAuth.ts. This is the case that regressed.
    it('is off when NODE_ENV is "testing", the value this repo actually uses', async () => {
        process.env.NODE_ENV = 'testing';
        expect((await loadConfig()).ssl).toBe(false);
    });

    it.each(['development', 'test', 'staging', 'anything-else'])(
        'is off for NODE_ENV=%s, so no unrecognised value turns TLS on',
        async (env) => {
            process.env.NODE_ENV = env;
            expect((await loadConfig()).ssl).toBe(false);
        },
    );

    it('lets DB_SSL override the NODE_ENV default in both directions', async () => {
        process.env.NODE_ENV = 'testing';
        process.env.DB_SSL = 'on';
        expect((await loadConfig()).ssl).toEqual({ rejectUnauthorized: false });

        process.env.NODE_ENV = 'production';
        process.env.DB_SSL = 'off';
        expect((await loadConfig()).ssl).toBe(false);
    });

    it('tolerates whitespace and case in DB_SSL', async () => {
        process.env.DB_SSL = '  OFF ';
        expect((await loadConfig()).ssl).toBe(false);
    });

    it('verifies when asked', async () => {
        process.env.DB_SSL = 'verify';
        expect((await loadConfig()).ssl).toEqual({ rejectUnauthorized: true });
    });

    it('carries a custom CA through', async () => {
        process.env.DB_SSL = 'verify';
        process.env.DB_SSL_CA = 'PEM';
        expect((await loadConfig()).ssl).toEqual({ rejectUnauthorized: true, ca: 'PEM' });
    });

    it('rejects an unrecognised mode rather than silently choosing one', async () => {
        process.env.DB_SSL = 'yes-please';
        await expect(loadConfig()).rejects.toThrow(/DB_SSL must be one of/);
    });
});

describe('query timeout', () => {
    // The problem being solved is client-side: a stuck query holding a pool connection.
    //
    // 4.0.0 used pg's `statement_timeout` pool option, which pg sends in the **startup
    // packet**. PgBouncer - which production connects through - rejects startup
    // parameters outside its allow-list with a FATAL "unsupported startup parameter"
    // (SQLSTATE 08P01), so every connection was refused and the bot could not start.
    // `query_timeout` is a pg-side timer, sends nothing at connection time, and passes
    // through a pooler. Verified against PgBouncer 1.22 in transaction mode.
    it('uses query_timeout, not statement_timeout', async () => {
        const cfg = await loadConfig();
        expect(cfg.query_timeout).toBe(15000);
        expect(cfg.statement_timeout).toBeUndefined();
    });

    it('never sets a startup parameter that a pooler would refuse', async () => {
        const cfg = await loadConfig() as Record<string, unknown>;
        // pg forwards these to the server at connection time.
        for (const key of ['statement_timeout', 'idle_in_transaction_session_timeout', 'options', 'application_name']) {
            expect(cfg[key]).toBeUndefined();
        }
    });

    it('can be disabled with 0, for a database that sets it on the role instead', async () => {
        process.env.DB_STATEMENT_TIMEOUT_MS = '0';
        expect((await loadConfig()).query_timeout).toBe(0);
    });

    it('is configurable', async () => {
        process.env.DB_STATEMENT_TIMEOUT_MS = '4000';
        expect((await loadConfig()).query_timeout).toBe(4000);
    });
});

describe('other settings', () => {

    it('no longer drops idle connections after two seconds', async () => {
        expect((await loadConfig()).idleTimeoutMillis).toBe(30000);
    });

    it('fails when DATABASE is missing', async () => {
        delete process.env.DATABASE;
        await expect(loadConfig()).rejects.toThrow(/DATABASE is not set/);
    });

    // Importing the module must not throw: the migration runner and the tests both
    // import it without an automod database configured.
    it('can be imported without AUTOMOD_DATABASE set', async () => {
        delete process.env.AUTOMOD_DATABASE;
        vi.resetModules();
        await expect(import('../../src/api/dbConnect.js')).resolves.toBeDefined();
    });
});

describe('pool ceiling', () => {
    // The limit is per pool and per process. Three shards hold one pool each and the web
    // process holds two, so the default is a ceiling of 20 against a managed Postgres
    // that allows 22 backends. It used to be 10, which is 50 - survivable only because
    // production connects through PgBouncer, which nothing in the code requires.
    it('defaults to 4, which keeps five pools inside a 22-connection budget', async () => {
        const max = (await loadConfig()).max!;
        expect(max).toBe(4);
        expect(max * 5).toBeLessThan(22);
    });

    it('can be raised for a deployment that needs it', async () => {
        process.env.DB_POOL_MAX = '8';
        expect((await loadConfig()).max).toBe(8);
    });

    it('rejects a value that is not a positive integer', async () => {
        process.env.DB_POOL_MAX = '0';
        await expect(loadConfig()).rejects.toMatchObject({ code: 'CONFIG' });
    });
});
