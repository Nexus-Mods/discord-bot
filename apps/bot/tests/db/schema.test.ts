import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { getTableName, isTable } from 'drizzle-orm';
import * as schema from '@nexusmods/persistence/schema.js';

const DRIZZLE = path.join(process.cwd(), 'drizzle');

function sqlFiles(): string[] {
    return readdirSync(DRIZZLE).filter((f) => f.endsWith('.sql')).sort();
}

interface Journal { entries: { idx: number; tag: string }[] }

function journal(): Journal {
    return JSON.parse(readFileSync(path.join(DRIZZLE, 'meta', '_journal.json'), 'utf8')) as Journal;
}

describe('migration journal', () => {
    // A migration committed without its journal entry never runs; a journal entry
    // without its file makes the migrator throw on startup. Both are easy to do by
    // resolving a merge conflict in drizzle/ by hand.
    it('has exactly one entry per .sql file', () => {
        const tags = journal().entries.map((e) => e.tag).sort();
        expect(tags).toEqual(sqlFiles().map((f) => f.replace(/\.sql$/, '')));
    });

    it('numbers entries contiguously from zero', () => {
        const idx = journal().entries.map((e) => e.idx);
        expect(idx).toEqual(idx.map((_, i) => i));
    });

    it('starts at the baseline', () => {
        expect(journal().entries[0]?.tag).toBe('0000_baseline');
    });
});

describe('baseline migration', () => {
    const sql = readFileSync(path.join(DRIZZLE, '0000_baseline.sql'), 'utf8');

    // The baseline runs against the live pre-4.0.0 database, where every one of
    // these tables already exists. Without IF NOT EXISTS the first deploy aborts.
    it('creates every table idempotently', () => {
        const bare = sql.match(/^CREATE TABLE (?!IF NOT EXISTS)/gm) ?? [];
        expect(bare).toEqual([]);
        expect(sql.match(/^CREATE TABLE IF NOT EXISTS/gm)?.length).toBeGreaterThan(0);
    });

    // ADD CONSTRAINT has no IF NOT EXISTS, so it has to be guarded explicitly.
    it('guards the foreign key against already existing', () => {
        expect(sql).toContain('ADD CONSTRAINT "fk_parent"');
        expect(sql).toContain('WHEN duplicate_object THEN NULL');
    });

    it('declares a table for every table in schema.ts', () => {
        const declared = Object.values(schema).filter(isTable).map(getTableName);
        expect(declared.length).toBeGreaterThan(0);
        for (const name of declared) {
            expect(sql).toContain(`CREATE TABLE IF NOT EXISTS "${name}"`);
        }
    });

    it('names no table twice', () => {
        const declared = Object.values(schema).filter(isTable).map(getTableName);
        expect(new Set(declared).size).toBe(declared.length);
    });
});
