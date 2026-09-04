import { describe, it, expect } from 'vitest';
import { NexusAPIServerError } from '../../src/types/NexusAPIError.js';

/**
 * The v1 client's status-to-message mapper.
 *
 * It used to take an AxiosError and read `error.response?.status`, which is why it had
 * no tests: constructing one meant constructing an axios error. It takes a number now,
 * so the table it implements can simply be asserted - and the first run of that
 * assertion found the 400 case had been wrong the whole time.
 */
describe('NexusAPIServerError', () => {
    const err = (status: number | undefined) => new NexusAPIServerError(status, 'OAUTH', '/v1/games.json');

    it.each([
        [400, 'Bad Request'],
        [401, 'Unauthorised'],
        [404, 'Not found'],
        [403, 'Client Error'],
        [429, 'Client Error'],
        [500, 'Internal Server Error'],
        [504, 'Request Timed Out'],
    ])('maps %i to %s', (status, name) => {
        expect(err(status).name).toBe(name);
    });

    // The regression this file was written for. The 400 branch set its name and message,
    // then fell through into the 401/404 chain, missed both, and hit the generic else -
    // so the specific message was overwritten by the vague one on the very next line.
    it('keeps the Bad Request message for a 400', () => {
        expect(err(400).message).toContain('try unlinking and relinking');
        expect(err(400).message).not.toContain('There was an issue with the request');
    });

    it('carries the path and auth type for the log line', () => {
        const e = err(404);
        expect(e.path).toBe('/v1/games.json');
        expect(e.authType).toBe('OAUTH');
        expect(e.code).toBe(404);
    });

    it('falls back to the unknown-error text when there is no status', () => {
        const e = err(undefined);
        expect(e.code).toBe(-1);
        expect(e.name).toBe('Unknown Error');
    });

    // Cloudflare and friends answer with codes outside the HTTP range; the mapper is
    // explicitly not meant to guess at those.
    it('does not try to classify a status above 599', () => {
        expect(err(999).name).toBe('Unknown Error');
    });

    it.each([[100, 'Unexpected HTTP response 100'], [302, 'Unexpected HTTP response 302']])(
        'labels %i as unexpected rather than an error class', (status, name) => {
            expect(err(status).name).toBe(name);
        });
});
