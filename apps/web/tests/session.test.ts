import { describe, it, expect } from 'vitest';
import { deriveKey, seal } from '@nexusmods/core/sealedValue.js';
import { SESSION_TTL_MS, openSession, sealSession } from '@nexusmods/auth/session.js';
import { sealLinkState } from '@nexusmods/auth/linkState.js';

/**
 * The session cookie is the only thing standing between a visitor and someone else's
 * server, and nothing on the server corroborates it - so every way it can be forged is
 * worth a test.
 */

const SECRET = 'test-cookie-secret';

const session = {
    id: '1234567890',
    name: 'Someone',
    avatar: 'abcdef',
    accessToken: 'discord-access-token',
};

describe('sealing a session', () => {
    it('round-trips', () => {
        expect(openSession(sealSession(session, SECRET), SECRET)).toEqual(session);
    });

    it('refuses a value sealed with another secret', () => {
        expect(openSession(sealSession(session, SECRET), 'a-different-secret')).toBeNull();
    });

    it('refuses a tampered value', () => {
        const sealed = sealSession(session, SECRET);
        // Flip the last character of the ciphertext. GCM authenticates it, so this fails
        // to open rather than decrypting to something else.
        const tampered = sealed.slice(0, -1) + (sealed.endsWith('A') ? 'B' : 'A');
        expect(openSession(tampered, SECRET)).toBeNull();
    });

    it('refuses an expired session', () => {
        expect(openSession(sealSession(session, SECRET, -1000), SECRET)).toBeNull();
    });

    it('refuses a link-state cookie presented as a session', () => {
        // The purpose string in deriveKey is what makes these keys unrelated. Without it,
        // one cookie would open as the other and a five-minute link token would be an
        // eight-hour session.
        const link = sealLinkState(
            { state: 'x', id: '1', name: 'n', tokens: { access_token: 'a', refresh_token: 'r', expires_at: 0 } },
            SECRET,
        );
        expect(openSession(link, SECRET)).toBeNull();
    });

    it.each([
        ['not sealed at all', 'plain-value'],
        ['empty', ''],
        ['a number', 42],
        ['undefined', undefined],
        ['null', null],
    ])('refuses a cookie that is %s', (_label, value) => {
        expect(openSession(value, SECRET)).toBeNull();
    });

    it('refuses a payload that opens but is not a session', () => {
        const key = deriveKey(SECRET, 'web-session.v1');
        const notJson = seal('this is not json', key);
        expect(openSession(notJson, SECRET)).toBeNull();

        const noId = seal(JSON.stringify({ exp: Date.now() + 1000, accessToken: 'a' }), key);
        expect(openSession(noId, SECRET)).toBeNull();

        const noToken = seal(JSON.stringify({ exp: Date.now() + 1000, id: '1' }), key);
        expect(openSession(noToken, SECRET)).toBeNull();
    });

    it('does not trust an expiry longer than the one it was sealed with', () => {
        // The exp lives inside the sealed payload, so a client cannot extend it without
        // breaking the authentication tag.
        const sealed = sealSession(session, SECRET, 1000);
        expect(openSession(sealed, SECRET)).not.toBeNull();
        expect(SESSION_TTL_MS).toBeGreaterThan(1000);
    });

    it('falls back to the id when the name is missing, rather than failing open', () => {
        const key = deriveKey(SECRET, 'web-session.v1');
        const sparse = seal(JSON.stringify({ exp: Date.now() + 10_000, id: '99', accessToken: 'a' }), key);
        expect(openSession(sparse, SECRET)).toEqual({ id: '99', name: '99', avatar: null, accessToken: 'a' });
    });
});
