import { describe, it, expect } from 'vitest';
import cookieParser from 'cookie-parser';
import signature from 'cookie-signature';
import { cookieAttributes, signCookieValue, unsignCookieValue } from '@/lib/security/signedCookies';

const SECRET = 'a-secret-that-is-not-the-real-one';

describe('signing', () => {
    it('round trips', () => {
        expect(unsignCookieValue(signCookieValue('hello', SECRET), SECRET)).toBe('hello');
    });

    it('survives the values these cookies actually carry', () => {
        // The link-state cookie is a sealed envelope: v1.iv.tag.ciphertext, base64url,
        // full of dots. The signature is split on the *last* dot for exactly this reason.
        const sealed = 'v1.abcDEF123.ghiJKL456.mnoPQR789-_xyz';
        expect(unsignCookieValue(signCookieValue(sealed, SECRET), SECRET)).toBe(sealed);
        expect(unsignCookieValue(signCookieValue('', SECRET), SECRET)).toBe('');
    });

    it('rejects a value that has been edited', () => {
        const signed = signCookieValue('discord-id-123', SECRET);
        const tampered = signed.replace('discord-id-123', 'discord-id-456');
        expect(unsignCookieValue(tampered, SECRET)).toBeUndefined();
    });

    it('rejects a signature made with a different secret', () => {
        expect(unsignCookieValue(signCookieValue('hello', 'other'), SECRET)).toBeUndefined();
    });

    it('rejects anything that is not a signed cookie', () => {
        expect(unsignCookieValue(undefined, SECRET)).toBeUndefined();
        expect(unsignCookieValue('', SECRET)).toBeUndefined();
        // No s: prefix - an unsigned cookie, which must not be read as a signed one.
        expect(unsignCookieValue('hello.abc', SECRET)).toBeUndefined();
        expect(unsignCookieValue('s:', SECRET)).toBeUndefined();
        expect(unsignCookieValue('s:nodot', SECRET)).toBeUndefined();
        expect(unsignCookieValue('s:.onlysig', SECRET)).toBeUndefined();
    });
});

/**
 * The claim in signedCookies.ts is that this is bit-for-bit cookie-parser's format, so
 * that during the cutover a cookie set by either server is readable by the other. That is
 * a claim about another library's behaviour, so it is checked against that library rather
 * than against a string someone typed from memory.
 */
describe('interoperability with cookie-parser', () => {
    const values = ['hello', 'discord-id-123', 'v1.abc.def.ghi', 'has spaces', '', '=padding=='];

    it('produces exactly what cookie-parser would have stored', () => {
        for (const value of values) {
            expect(signCookieValue(value, SECRET), value).toBe(`s:${signature.sign(value, SECRET)}`);
        }
    });

    it('reads what cookie-parser wrote', () => {
        for (const value of values) {
            const asExpressStoredIt = `s:${signature.sign(value, SECRET)}`;
            expect(unsignCookieValue(asExpressStoredIt, SECRET), value).toBe(value);
        }
    });

    it('is read by cookie-parser as what we wrote', () => {
        for (const value of values) {
            expect(cookieParser.signedCookie(signCookieValue(value, SECRET), SECRET), value).toBe(value);
        }
    });

    it('and cookie-parser rejects our tampered cookies too', () => {
        const signed = signCookieValue('discord-id-123', SECRET);
        const tampered = signed.replace('discord-id-123', 'discord-id-456');
        expect(cookieParser.signedCookie(tampered, SECRET)).toBe(false);
    });
});

describe('cookie attributes', () => {
    it('converts Express milliseconds to the seconds Next wants', () => {
        // The bug this exists to prevent: cookieOptions in @nexusmods/auth takes ms, the
        // Next cookie API takes seconds, and five minutes would silently become five
        // seconds - long enough to work on a fast connection and fail on a slow one.
        expect(cookieAttributes(5 * 60 * 1000).maxAge).toBe(300);
        expect(cookieAttributes(2 * 60 * 1000).maxAge).toBe(120);
    });

    it('keeps the value out of page scripts and off cross-site requests', () => {
        const attrs = cookieAttributes(1000);
        expect(attrs.httpOnly).toBe(true);
        // lax, not strict: the cookie has to survive the OAuth redirect chain coming back
        // from Discord and Nexus Mods.
        expect(attrs.sameSite).toBe('lax');
        expect(attrs.path).toBe('/');
    });

    it('is not marked secure outside production, so a local HTTP run works', () => {
        expect(cookieAttributes(1000).secure).toBe(false);
    });
});
