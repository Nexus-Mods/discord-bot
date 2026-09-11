import type { Metadata } from 'next';
import { UnlinkFailed } from '@/components/UnlinkFailed';
import { ERROR_DETAIL_COOKIE, readSignedCookieFromStore } from '@/lib/link/cookies';

/**
 * Ported from unlinkerrormessage.ejs. Keeps the Express path, /unlink-error.
 *
 * The body lives in a component because /revoke renders it too - see UnlinkFailed for
 * why that route cannot redirect here.
 *
 * The message comes from the signed ErrorDetail cookie, not from `?error=`. Step 6 read a
 * query parameter because there was no server behind the page to set a cookie. That is a
 * hole: a query parameter is whatever the visitor's URL says, so anyone could hand out a
 * link to this page on the real domain with any text they liked in the error box. A signed
 * cookie can only have been set by this server, which is why Express used one, and why the
 * fallback asks about cookies rather than about the URL.
 *
 * Reading a cookie is a Request API, so this page is per-request without needing
 * `connection()`.
 */
export const metadata: Metadata = { title: 'Unlinking Error' };

const NO_ERROR = 'No error recorded. Are you blocking cookies?';

export default async function UnlinkError() {
    const error = await readSignedCookieFromStore(ERROR_DETAIL_COOKIE) ?? NO_ERROR;
    return <UnlinkFailed error={error} />;
}
