import { describe, it, expect } from 'vitest';
import {
    AppError, DatabaseError, NexusApiError, NotFoundError, ConfigError,
    toError, userMessageFor,
} from '../../src/api/errors.js';

describe('AppError', () => {
    it('is a real Error, so instanceof and stacks work', () => {
        const err = new AppError('boom');
        expect(err).toBeInstanceOf(Error);
        expect(err.stack).toContain('errors.test');
    });

    it('preserves the cause rather than flattening it to a message', () => {
        const root = new Error('connect ECONNREFUSED');
        const err = new DatabaseError('Failed to fetch channels.', { cause: root });
        expect(err.cause).toBe(root);
    });

    it('names itself after the subclass', () => {
        expect(new DatabaseError('x').name).toBe('DatabaseError');
        expect(new NexusApiError('x').name).toBe('NexusApiError');
    });

    it.each([
        [new DatabaseError('x'), 'DATABASE'],
        [new NexusApiError('x'), 'NEXUS_API'],
        [new NotFoundError('x'), 'NOT_FOUND'],
        [new ConfigError('x'), 'CONFIG'],
        [new AppError('x'), 'UNKNOWN'],
    ])('carries the right code', (err, code) => {
        expect(err.code).toBe(code);
    });

    it('treats a config problem as a bug, not a blip', () => {
        // A missing environment variable will not fix itself on retry.
        expect(new ConfigError('COOKIE_SECRET missing').isOperational).toBe(false);
        expect(new DatabaseError('timeout').isOperational).toBe(true);
    });

    it('keeps context for the logs', () => {
        const err = new DatabaseError('x', { context: { guildId: '1', keys: ['a'] } });
        expect(err.context).toEqual({ guildId: '1', keys: ['a'] });
    });
});

describe('userMessageFor', () => {
    it('returns the message written for the user', () => {
        const err = new DatabaseError('SELECT failed on users', { userMessage: 'Database connection timed out.' });
        expect(userMessageFor(err)).toBe('Database connection timed out.');
    });

    it('never returns the internal message of a plain Error', () => {
        // Guards the S6 class of bug: an internal message reaching a Discord embed.
        const leak = new Error('auth failed: token=nx_SECRET_abc123');
        expect(userMessageFor(leak)).not.toContain('nx_SECRET_abc123');
    });

    it('defaults an AppError with no userMessage to the generic line', () => {
        expect(userMessageFor(new AppError('internal detail'))).not.toContain('internal detail');
    });
});

describe('toError', () => {
    it('passes an Error through unchanged', () => {
        const err = new Error('x');
        expect(toError(err)).toBe(err);
    });

    it.each([
        ['a bare string', 'a bare string'],
        [false, 'false'],
        [42, '42'],
    ])('converts %j, which this codebase used to throw', (input, expected) => {
        const result = toError(input);
        expect(result).toBeInstanceOf(Error);
        expect(result.message).toBe(expected);
    });

    it('survives a value that cannot be serialised', () => {
        const cyclic: Record<string, unknown> = {};
        cyclic.self = cyclic;
        expect(() => toError(cyclic)).not.toThrow();
    });
});
