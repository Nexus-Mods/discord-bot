import { NextResponse, type NextRequest } from 'next/server';
import { rateLimitKey } from '@/lib/security/clientIp';
import {
    CSP_REPORT_PATH, SECURITY_HEADERS, contentSecurityPolicy, cspHeaderName,
} from '@/lib/security/headers';
import {
    FixedWindowCounter, GENERAL, SENSITIVE, isSensitive, rateLimitHeaders,
} from '@/lib/security/rateLimit';

/**
 * The network boundary: everything Express did with `app.use` before a route ran.
 *
 * Named `proxy` rather than `middleware` because Next 16 renamed the convention - the old
 * name was being confused with Express middleware, which is exactly what this is a port
 * of, so the rename is unhelpful here and unavoidable. Next's own guidance is to avoid
 * this file where another mechanism exists; of the six concerns, three genuinely have no
 * other home:
 *
 *   rate limiting     has to run before a page renders, and pages have no handler to wrap
 *   the CSP nonce     has to be generated per request and reach both the header and the
 *                     document, which is the documented Next pattern
 *   the client IP     is what rate limiting keys on
 *
 * The other three - signed cookies, the body cap and the shared secret - are per-route and
 * live with the routes, which is where step 8 puts them.
 *
 * It runs on the Node runtime. The docs say this file defaults to the Edge runtime, and
 * that is worth knowing because Edge has no node:crypto and no long-lived module state,
 * which would take out both the nonce and the counters. Verified rather than assumed: a
 * probe that imported node:crypto failed to build as `middleware.ts` and compiled clean as
 * `proxy.ts`, and the running server reported `process.versions.node`.
 */

/**
 * Module state, and the reason this is not as fragile as it looks.
 *
 * Two counters live for the lifetime of the process, which is what makes a fixed window
 * possible at all. Next may evaluate this module more than once in development - each
 * recompile is a fresh module - so the limits reset when a file is saved. In production
 * `next start` evaluates it once.
 */
const general = new FixedWindowCounter(GENERAL);
const sensitive = new FixedWindowCounter(SENSITIVE);

/**
 * Static assets are not rate limited, and get no nonce.
 *
 * Express did not limit them either - `express.static` was mounted before the limiter -
 * and a page pulling eight images would otherwise spend a tenth of its allowance on
 * rendering itself once.
 */
export const config = {
    matcher: ['/((?!_next/static|_next/image|images/|nexus-logo\\.svg|favicon\\.ico).*)'],
};

export function proxy(request: NextRequest): NextResponse {
    const { pathname } = request.nextUrl;

    // The report endpoint is exempt. A page that is violating its policy generates a
    // report per violation, and 429-ing the reports would hide exactly the signal the
    // report-only phase exists to collect.
    const limited = pathname !== CSP_REPORT_PATH;

    if (limited) {
        const key = rateLimitKey(request.headers);

        // Both counters, in Express's order: the general limiter is app.use'd before the
        // routes and the sensitive one is registered on top of it, so a sensitive request
        // spends from both allowances.
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

        // The tighter of the two is the one worth reporting: a client watching the header
        // to back off should see the limit it will actually hit first.
        const reported = sensitiveHit ?? generalHit;
        return withSecurity(request, rateLimitHeaders(reported));
    }

    return withSecurity(request, {});
}

function withSecurity(request: NextRequest, extra: Record<string, string>): NextResponse {
    // crypto.randomUUID is on globalThis in both runtimes and is 122 bits of randomness,
    // which is well past the 128-bit-of-entropy-per-request guidance once base64'd - and
    // it avoids importing node:crypto so this file stays portable if it ever does have to
    // run on the Edge.
    const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

    // The nonce reaches the document through a request header, which is how Next exposes
    // it to a Server Component: layout.tsx reads it back with headers(). Setting it on the
    // response would be too late - the page has already rendered by then.
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
