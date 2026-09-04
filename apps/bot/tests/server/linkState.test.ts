import { describe, it, expect, vi, afterEach } from 'vitest';
import { LINK_STATE_TTL_MS, openLinkState, sealLinkState, type LinkState } from '../../src/server/linkState.js';

const SECRET = 'a-cookie-secret-of-a-realistic-length-0123456789';
const STATE = 'nS8xQ2p0YkR2VzloTmpZeA';

const payload: LinkState = {
    state: STATE,
    id: '215154001799413770',
    name: 'Pickysaurus#0',
    tokens: {
        access_token: 'a'.repeat(30),
        refresh_token: 'r'.repeat(30),
        expires_at: 1_800_000_000_000,
        token_type: 'Bearer',
        scope: 'role_connections.write identify',
    },
};

afterEach(() => { vi.useRealTimers(); });

describe('sealing', () => {
    it('round-trips the payload the Nexus callback needs', () => {
        const opened = openLinkState(sealLinkState(payload, SECRET), SECRET, STATE);
        expect(opened).toEqual(payload);
    });

    it('produces a different ciphertext each time, so the cookie is not a stable fingerprint', () => {
        expect(sealLinkState(payload, SECRET)).not.toBe(sealLinkState(payload, SECRET));
    });

    // The reason this fits in a cookie at all. Browsers cap a cookie at about 4 KB.
    it('stays well inside the cookie size limit, even with oversized tokens', () => {
        expect(sealLinkState(payload, SECRET).length).toBeLessThan(1024);
        const big = { ...payload, tokens: { ...payload.tokens, access_token: 'a'.repeat(255), refresh_token: 'r'.repeat(255) } };
        expect(sealLinkState(big, SECRET).length).toBeLessThan(2048);
    });

    it('does not leak the tokens into the cookie in readable form', () => {
        const sealed = sealLinkState(payload, SECRET);
        expect(sealed).not.toContain(payload.tokens.access_token);
        expect(sealed).not.toContain(payload.tokens.refresh_token);
        expect(sealed).not.toContain(payload.id);
    });
});

describe('rejection', () => {
    const cases: [string, () => unknown][] = [
        ['a tampered ciphertext', () => sealLinkState(payload, SECRET).slice(0, -4) + 'AAAA'],
        ['a tampered auth tag', () => { const p = sealLinkState(payload, SECRET).split('.'); p[2] = Buffer.from('0'.repeat(16)).toString('base64url'); return p.join('.'); }],
        ['a value sealed with a different secret', () => sealLinkState(payload, 'some-other-secret-entirely')],
        ['an unknown format version', () => 'v2' + sealLinkState(payload, SECRET).slice(2)],
        ['a malformed value', () => 'not-a-sealed-cookie'],
        ['an empty string', () => ''],
        ['a missing cookie', () => undefined],
        ['cookie-parser\'s signature-failure value', () => false],
    ];
    it.each(cases)('rejects %s', (_label, make) => {
        expect(openLinkState(make(), SECRET, STATE)).toBeNull();
    });

    // Without this, a cookie captured from one link attempt could complete another.
    it('rejects a payload sealed for a different OAuth state', () => {
        const sealed = sealLinkState(payload, SECRET);
        expect(openLinkState(sealed, SECRET, 'a-completely-different-state')).toBeNull();
    });

    it('rejects when the state inside was altered to match a different flow', () => {
        const sealed = sealLinkState({ ...payload, state: 'attacker-chosen-state' }, SECRET);
        expect(openLinkState(sealed, SECRET, STATE)).toBeNull();
    });
});

describe('expiry', () => {
    // The cookie's maxAge is a client-side courtesy; nothing stops a client sending an
    // expired cookie forever. The expiry that matters is the one inside the payload.
    it('rejects a payload past its expiry even though the cookie was replayed intact', () => {
        vi.useFakeTimers();
        const sealed = sealLinkState(payload, SECRET);
        expect(openLinkState(sealed, SECRET, STATE)).not.toBeNull();
        vi.advanceTimersByTime(LINK_STATE_TTL_MS + 1000);
        expect(openLinkState(sealed, SECRET, STATE)).toBeNull();
    });

    it('still opens just inside the window', () => {
        vi.useFakeTimers();
        const sealed = sealLinkState(payload, SECRET);
        vi.advanceTimersByTime(LINK_STATE_TTL_MS - 1000);
        expect(openLinkState(sealed, SECRET, STATE)).not.toBeNull();
    });
});
