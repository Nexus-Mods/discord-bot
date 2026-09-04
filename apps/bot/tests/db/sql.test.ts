import { describe, it, expect } from 'vitest';
import { buildUpdate, columnNames } from '../../src/db/sql.js';
import { users, servers } from '../../src/db/schema.js';

describe('columnNames', () => {
    it('reads the real column names from the schema', () => {
        const cols = columnNames(users);
        expect(cols.has('d_id')).toBe(true);
        expect(cols.has('nexus_access')).toBe(true);
        // the TS property is dId; the allow-list must hold the SQL name, not that
        expect(cols.has('dId')).toBe(false);
    });
});

describe('buildUpdate', () => {
    it('parameterises values and quotes column names', () => {
        const { text, values } = buildUpdate(
            users, 'users',
            { name: 'Bob', premium: true },
            { column: 'd_id', value: '123' },
        );
        expect(text).toBe('UPDATE "users" SET "name" = $1, "premium" = $2 WHERE "d_id" = $3');
        expect(values).toEqual(['Bob', true, '123']);
    });

    // The whole point: a key that is not a real column must never reach the SQL.
    it('rejects a column that is not in the schema', () => {
        expect(() => buildUpdate(
            users, 'users',
            { name: 'Bob', 'evil" = 1, "name': 'x' },
            { column: 'd_id', value: '1' },
        )).toThrow(/Unknown column/);
    });

    it('rejects an injected WHERE column', () => {
        expect(() => buildUpdate(
            users, 'users', { name: 'Bob' },
            { column: 'd_id" OR "1"="1', value: '1' },
        )).toThrow(/Unknown column/);
    });

    it('rejects an empty update rather than emitting invalid SQL', () => {
        expect(() => buildUpdate(users, 'users', {}, { column: 'd_id', value: '1' }))
            .toThrow(/No columns to update/);
    });

    // undefined means "not supplied"; null is a value the caller means to write.
    it('skips undefined but keeps null', () => {
        const { text, values } = buildUpdate(
            servers, 'servers',
            { channel_nexus: null, channel_news: undefined, game_filter: 'skyrim' },
            { column: 'id', value: '9' },
        );
        expect(text).toBe('UPDATE "servers" SET "channel_nexus" = $1, "game_filter" = $2 WHERE "id" = $3');
        expect(values).toEqual([null, 'skyrim', '9']);
    });

    it('throws when every supplied value is undefined', () => {
        expect(() => buildUpdate(
            servers, 'servers', { game_filter: undefined },
            { column: 'id', value: '9' },
        )).toThrow(/No columns to update/);
    });

    it('numbers placeholders correctly for a single column', () => {
        const { text, values } = buildUpdate(
            servers, 'servers', { official: true }, { column: 'id', value: '5' },
        );
        expect(text).toBe('UPDATE "servers" SET "official" = $1 WHERE "id" = $2');
        expect(values).toEqual([true, '5']);
    });
});
