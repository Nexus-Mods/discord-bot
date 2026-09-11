import { NextResponse, type NextRequest } from 'next/server';
import { rateLimitKey } from '@/lib/security/clientIp';
import {
    CSP_REPORT_PATH, SECURITY_HEADERS, contentSecurityPolicy, cspHeaderName,
} from '@/lib/security/headers';
import {
    FixedWindowCounter, GENERAL, SENSITIVE, isSensitive, rateLimitHeaders,
} from '@/lib/security/rateLimit';

/**
 * The network boundary: everything Express did with `app.use` before a route ran - rate
 * limiting, the CSP nonce and the client IP. The per-route concerns (signed cookies, the
 * body cap, the shared secrets) live with their routes.
 *
 * `proxy`, not `middleware`: Next 16 renamed the convention. It runs on the Node runtime,
 * which matters - Edge has no node:crypto and no long-lived module state, so neither the
 * nonce nor the counters would work there.
 */

/** Process-lifetime counters. In development each recompile resets them; `next start` does not. */
const general = new FixedWindowCounter(GENERAL);
const sensitive = new FixedWindowCounter(SENSITIVE);

/** Static assets are not limited: a page pulling eight images would spend a tenth of its allowance. */
export const config = {
    matcher: ['/((?!_next/static|_next/image|images/|nexus-logo\\.svg|favicon\\.ico).*)'],
};

export function proxy(request: NextRequest): NextResponse {
    const { pathname } = request.nextUrl;

    // The report endpoint is exempt: 429-ing reports would hide the signal they exist for.
    const limited = pathname !== CSP_REPORT_PATH;

    if (limited) {
        const key = rateLimitKey(request.headers);

        // A sensitive request spends from both allowances, as in Express.
        const generalHit = general.hit(key);
        const sensitiveHit = isSensitive(pathname) ? sensitive.hit(key) : undefined;
        const refused = !generalHit.ok ? generalHit : (sensitiveHit && !sensitiveHit.ok ? sensitiveHit : undefined);

        if (refused) {
            return new NextResponse('Too Many Requests', {
                status: 429,
                headers: {
                    ...SECURITY_HEADERS,
                    ...rateLimitHeaders(refused),
                    'Retry-After': String(refused.resetSeconds),
                    'Content-Type': 'text/plain; charset=utf-8',
                },
            });
        }

        // Report the tighter of the two: it is the limit a client will hit first.
        const reported = sensitiveHit ?? generalHit;
        return withSecurity(request, rateLimitHeaders(reported));
    }

    return withSecurity(request, {});
}

function withSecurity(request: NextRequest, extra: Record<string, string>): NextResponse {
    // globalThis.crypto, not node:crypto, so this file stays portable to the Edge.
    const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

    // On the REQUEST headers: layout.tsx reads it back with headers(). Setting it on the
    // response would be too late, since the page has already rendered.
    const headers = new Headers(request.headers);
    headers.set('x-nonce', nonce);

    const response = NextResponse.next({ request: { headers } });

    for (const [name, value] of Object.entries({ ...SECURITY_HEADERS, ...extra })) {
        response.headers.set(name, value);
    }
    response.headers.set(
        cspHeaderName(),
        contentSecurityPolicy({ nonce, reportUri: CSP_REPORT_PATH }),
    );
    // Declares the group the policy's `report-to csp` directive names.
    response.headers.set('Reporting-Endpoints', `csp="${CSP_REPORT_PATH}"`);

    return response;
}
