import { describe, it, expect } from 'vitest';
import { clientIp, rateLimitKey, trustedProxyCount } from '@/lib/security/clientIp';

const h = (forwarded?: string) => new Headers(forwarded === undefined ? {} : { 'x-forwarded-for': forwarded });

describe('trustedProxyCount', () => {
    it('is zero when TRUST_PROXY is unset', () => {
        expect(trustedProxyCount({})).toBe(0);
        expect(trustedProxyCount({ TRUST_PROXY: '' })).toBe(0);
    });

    it('reads the number', () => {
        expect(trustedProxyCount({ TRUST_PROXY: '1' })).toBe(1);
        expect(trustedProxyCount({ TRUST_PROXY: '3' })).toBe(3);
    });

    it('treats a present but unusable value as one proxy', () => {
        // Setting it at all means there is a proxy. Express does the same, and the
        // alternative - falling back to zero - turns a typo into "trust nothing", which
        // silently puts every visitor in one rate-limit bucket.
        expect(trustedProxyCount({ TRUST_PROXY: 'yes' })).toBe(1);
        expect(trustedProxyCount({ TRUST_PROXY: '0' })).toBe(1);
        expect(trustedProxyCount({ TRUST_PROXY: '-2' })).toBe(1);
    });
});

describe('clientIp', () => {
    it('ignores the header entirely when no proxy is configured', () => {
        // Nothing verified it, so nothing may be believed. This is local development.
        expect(clientIp(h('1.2.3.4'), {})).toBeUndefined();
    });

    it('takes the only entry behind one proxy', () => {
        expect(clientIp(h('1.2.3.4'), { TRUST_PROXY: '1' })).toBe('1.2.3.4');
    });

    it('takes the Nth from the right behind N proxies', () => {
        // client -> p1 -> p2 -> app. p1 appends the client, p2 appends p1.
        expect(clientIp(h('1.2.3.4, 10.0.0.1'), { TRUST_PROXY: '2' })).toBe('1.2.3.4');
    });

    it('is not fooled by a client that sends its own header', () => {
        // THE test. A client sending `X-Forwarded-For: 9.9.9.9` gets its real address
        // appended by the proxy, so counting from the left would hand every attacker a
        // fresh rate-limit bucket per request.
        expect(clientIp(h('9.9.9.9, 1.2.3.4'), { TRUST_PROXY: '1' })).toBe('1.2.3.4');
        expect(clientIp(h('9.9.9.9, 8.8.8.8, 1.2.3.4'), { TRUST_PROXY: '1' })).toBe('1.2.3.4');
        expect(clientIp(h('9.9.9.9, 1.2.3.4, 10.0.0.1'), { TRUST_PROXY: '2' })).toBe('1.2.3.4');
    });

    it('clamps when the chain is shorter than the hop count', () => {
        // A request that arrived from inside the network, or a proxy that did not append.
        // The leftmost entry is the closest thing to a client that exists.
        expect(clientIp(h('1.2.3.4'), { TRUST_PROXY: '3' })).toBe('1.2.3.4');
    });

    it('is undefined when there is no header to read', () => {
        expect(clientIp(h(), { TRUST_PROXY: '1' })).toBeUndefined();
        expect(clientIp(h('   '), { TRUST_PROXY: '1' })).toBeUndefined();
        expect(clientIp(h(' , , '), { TRUST_PROXY: '1' })).toBeUndefined();
    });

    it('tolerates the spacing real proxies use', () => {
        expect(clientIp(h('1.2.3.4,10.0.0.1'), { TRUST_PROXY: '2' })).toBe('1.2.3.4');
        expect(clientIp(h('  1.2.3.4 ,  10.0.0.1  '), { TRUST_PROXY: '2' })).toBe('1.2.3.4');
    });
});

describe('rateLimitKey', () => {
    it('is the client address when there is one', () => {
        expect(rateLimitKey(h('1.2.3.4'), { TRUST_PROXY: '1' })).toBe('1.2.3.4');
    });

    it('is one shared bucket when the client cannot be identified', () => {
        // Deliberately not a bypass. Of the two ways to be wrong, throttling everyone
        // together is the one somebody notices; letting everyone through is not.
        expect(rateLimitKey(h(), { TRUST_PROXY: '1' })).toBe('unidentified');
        expect(rateLimitKey(h('1.2.3.4'), {})).toBe('unidentified');
    });
});
