import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const KEYS = ['DATABASE', 'DBPORT', 'PORT', 'DB_SSL', 'DB_SSL_CA', 'NODE_ENV', 'DB_STATEMENT_TIMEOUT_MS', 'AUTOMOD_DATABASE'];
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
    // Previously `NODE_ENV === 'production' || NODE_ENV === undefined`, so verification
    // was off by accident on any machine that had not set NODE_ENV.
    it('encrypts without verifying by default, preserving current behaviour', async () => {
        expect((await loadConfig()).ssl).toEqual({ rejectUnauthorized: false });
    });

    it('is off for local development', async () => {
        process.env.NODE_ENV = 'development';
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

describe('other settings', () => {
    it('sets a statement timeout, which used to be commented out', async () => {
        expect((await loadConfig()).statement_timeout).toBe(15000);
    });

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
