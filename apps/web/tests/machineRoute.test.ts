import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { json, requireSharedSecret, text, unexpected } from '@/lib/machineRoute';

/**
 * The guard on three of the four machine endpoints.
 *
 * The property that matters is the last one: with the secret unset the endpoint refuses
 * everything. It used to be the other way round - a missing AUTOMOD_AUTHCODE left
 * /automod open to anyone - and the plan singles it out as behaviour that "has to survive"
 * the port. It is checked here at the boundary the routes actually call, as well as inside
 * @nexusmods/auth where the comparison lives.
 */
const request = (authorization?: string) =>
    new Request('https://discordbot.nexusmods.test/automod', {
        headers: authorization === undefined ? {} : { authorization },
    });

describe('requireSharedSecret', () => {
    beforeEach(() => { process.env.TEST_AUTHCODE = 'correct-horse'; });
    afterEach(() => { delete process.env.TEST_AUTHCODE; });

    it('lets the right header through', () => {
        expect(requireSharedSecret(request('correct-horse'), 'TEST_AUTHCODE')).toBeUndefined();
    });

    it('refuses a wrong or missing header with an empty 401', async () => {
        for (const header of ['wrong', '', undefined]) {
            const denied = requireSharedSecret(request(header), 'TEST_AUTHCODE');
            expect(denied?.status, String(header)).toBe(401);
            // Empty body: an unauthenticated caller learns nothing about why.
            expect(await denied!.text()).toBe('');
        }
    });

    it('FAILS CLOSED when the secret is not configured', () => {
        delete process.env.TEST_AUTHCODE;
        expect(requireSharedSecret(request('correct-horse'), 'TEST_AUTHCODE')?.status).toBe(401);
        expect(requireSharedSecret(request(), 'TEST_AUTHCODE')?.status).toBe(401);
        expect(requireSharedSecret(request('anything'), 'TEST_AUTHCODE')?.status).toBe(401);
    });
});

describe('the reply helpers', () => {
    it('sends plain text as plain text', async () => {
        const r = text('Invalid ID', 400);
        expect(r.status).toBe(400);
        expect(r.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
        expect(await r.text()).toBe('Invalid ID');
    });

    it('sends JSON as JSON', async () => {
        // Express sent these as text/html, because res.send() on a pre-stringified body
        // guesses. This is the one deliberate difference in the four endpoints.
        const r = json({ success: true }, 200);
        expect(r.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
        expect(await r.json()).toEqual({ success: true });
    });

    it('keeps the error shape the automod client already sees', async () => {
        expect(await unexpected(new Error('boom')).text()).toBe('Unexpected error: boom');
        expect(unexpected(new Error('boom')).status).toBe(500);
    });
});
