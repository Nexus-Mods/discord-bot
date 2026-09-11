import type { NextResponse } from 'next/server';
import { text } from '@/lib/machineRoute';
import { redirectTo } from '@/lib/link/flow';

/**
 * GET /localhost-redirect - bounce a browser back to an application listening on the
 * user's own machine.
 *
 * This exists because an OAuth provider will not redirect to 127.0.0.1 for a registered
 * application, so the round trip comes here and hops locally from there. The destination
 * is always loopback on this machine's own browser: the scheme, host and shape of the URL
 * are fixed here and only the port and an opaque token come from the request.
 */
const DEFAULT_PORT = '8080';
const DEFAULT_TOKEN = 'TestToken';

export async function GET(request: Request): Promise<NextResponse> {
    const params = new URL(request.url).searchParams;
    const port = params.get('port');
    const token = params.get('token');

    // Express's check, kept: a port that is present but not a number is refused, and an
    // absent one falls back to 8080. It does not check the range, so 99999 still produces
    // a URL - one no browser will connect to, which is a clearer failure than a 400 here
    // would be for a caller that has been passing it for years.
    if (port && isNaN(Number(port))) return text('Port not specified or invalid', 400);

    // Encoded, unlike Express: the token goes into a query string, and one containing an
    // ampersand or a hash silently truncated the rest of the URL.
    const query = encodeURIComponent(token ?? DEFAULT_TOKEN);
    return redirectTo(`http://127.0.0.1:${port ?? DEFAULT_PORT}?token=${query}`);
}
