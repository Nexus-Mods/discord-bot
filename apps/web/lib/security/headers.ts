/**
 * What helmet was setting, written out.
 *
 * helmet is fifteen small header setters behind one call, and `helmet()` in server.ts is
 * the default set with `contentSecurityPolicy: false`. Naming them here instead of taking
 * another dependency means the policy is reviewable in the diff rather than in a
 * changelog, and it is the only way to say *why* each one is set - which matters, because
 * three of helmet's defaults are for a kind of application this is not.
 *
 * Dropped from helmet's defaults, deliberately:
 *   - Expect-CT, which is deprecated and ignored by every current browser.
 *   - X-Powered-By removal: Next does not send it.
 *   - X-XSS-Protection: helmet sets it to `0` to *disable* the legacy auditor, which is
 *     right, and it is also the browser default now, so it is noise.
 */

export interface CspOptions {
    /** The per-request nonce, so Next's own inline scripts and styles are allowed by name. */
    nonce: string;
    /** Where violation reports go. Relative to this origin. */
    reportUri: string;
}

/**
 * The static headers. Nothing here depends on the request.
 *
 * HSTS is the one to look at twice: it tells browsers to refuse plain HTTP for this
 * hostname for two years. That is right for discordbot.nexusmods.com, which is HTTPS
 * only, and it is only sent over HTTPS anyway - browsers ignore it otherwise, so a local
 * HTTP run is unaffected. `preload` is deliberately absent: submitting to the preload
 * list is a decision with a slow and manual reversal, and it is not this commit's to
 * make.
 */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
    // Do not let a browser guess a content type. The tracking page renders names people
    // chose, and MIME sniffing is how a "text" response becomes a script.
    'X-Content-Type-Options': 'nosniff',
    // These pages are the tail of an OAuth flow; there is no reason to frame them, and
    // clickjacking an "unlink my accounts" button is the obvious attack. Also expressed
    // as frame-ancestors in the CSP, for browsers that prefer it.
    'X-Frame-Options': 'DENY',
    // Do not leak the query string - which carries account names and error detail - to
    // images.nexusmods.com or fonts.gstatic.com in a Referer.
    'Referrer-Policy': 'no-referrer',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
    'X-DNS-Prefetch-Control': 'off',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Origin-Agent-Cluster': '?1',
};

/**
 * The content policy.
 *
 * The Express site has CSP off because "the views load fonts from Google and images from
 * Nexus Mods", which is a reason to write an allowlist rather than a reason to have none.
 * There are four external hosts and they are all known:
 *
 *   fonts.googleapis.com   the Inter stylesheet. Goes away when the font is self-hosted -
 *                          see the note in app/layout.tsx.
 *   fonts.gstatic.com      the font files that stylesheet points at. Same.
 *   images.nexusmods.com   favicons and the OpenGraph image.
 *   cdn.discordapp.com     guild icons on the tracking page.
 *
 * `strict-dynamic` is what makes the nonce worth having: Next loads its chunks from
 * scripts that already carry the nonce, and strict-dynamic extends trust to what those
 * scripts load rather than requiring a nonce on every generated tag.
 */
export function contentSecurityPolicy({ nonce, reportUri }: CspOptions): string {
    return [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
        // Tailwind compiles to a stylesheet file; the nonce covers Next's inline style
        // tags, and fonts.googleapis.com is the Inter <link>.
        `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`,
        'font-src https://fonts.gstatic.com',
        "img-src 'self' data: https://images.nexusmods.com https://cdn.discordapp.com",
        // No XHR anywhere. These pages are server-rendered and submit forms; if that ever
        // stops being true this is the line that will say so.
        "connect-src 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "base-uri 'none'",
        "object-src 'none'",
        `report-uri ${reportUri}`,
        // report-to is the successor and browsers disagree about which they honour, so
        // both are sent. The group is declared by the Reporting-Endpoints header.
        'report-to csp',
    ].join('; ');
}

/**
 * Report-only, for now.
 *
 * The allowlist above is assembled by reading the code, and the thing an allowlist gets
 * wrong is the host nobody remembered. Report-only means a missed one arrives as a report
 * rather than as a blank page for someone in the middle of linking their account. Flip
 * this to false once the reports are quiet; it is the whole change.
 */
export const CSP_REPORT_ONLY = true;

export const CSP_REPORT_PATH = '/api/csp-report';

export function cspHeaderName(reportOnly: boolean = CSP_REPORT_ONLY): string {
    return reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';
}
