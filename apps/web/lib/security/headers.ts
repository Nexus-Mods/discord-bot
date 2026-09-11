/**
 * What helmet was setting, written out rather than taken as a dependency.
 *
 * Three of helmet's defaults are dropped: Expect-CT (deprecated), X-Powered-By removal
 * (Next does not send it) and X-XSS-Protection (now the browser default).
 */

export interface CspOptions {
    /** The per-request nonce, so Next's own inline scripts and styles are allowed by name. */
    nonce: string;
    /** Where violation reports go. Relative to this origin. */
    reportUri: string;
}

/**
 * The static headers. HSTS refuses plain HTTP for this hostname for two years; `preload`
 * is deliberately absent, since submitting to the preload list is hard to reverse.
 */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
    'X-Content-Type-Options': 'nosniff',
    // Clickjacking an "unlink my accounts" button is the obvious attack.
    'X-Frame-Options': 'DENY',
    // The query string carries account names and error detail; keep it out of Referer.
    'Referrer-Policy': 'no-referrer',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
    'X-DNS-Prefetch-Control': 'off',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Origin-Agent-Cluster': '?1',
};

/**
 * The content policy. Four external hosts: fonts.googleapis.com and fonts.gstatic.com for
 * Inter (both go away if the font is self-hosted), images.nexusmods.com for favicons, and
 * cdn.discordapp.com for guild icons.
 *
 * `strict-dynamic` extends the nonce's trust to what Next's own chunks load, rather than
 * needing a nonce on every generated tag.
 */
export function contentSecurityPolicy({ nonce, reportUri }: CspOptions): string {
    return [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
        `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`,
        'font-src https://fonts.gstatic.com',
        "img-src 'self' data: https://images.nexusmods.com https://cdn.discordapp.com",
        // No XHR: these pages are server-rendered and submit forms.
        "connect-src 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "base-uri 'none'",
        "object-src 'none'",
        `report-uri ${reportUri}`,
        // Both are sent; browsers disagree about which they honour.
        'report-to csp',
    ].join('; ');
}

/** Report-only until the reports are quiet. Flipping this to false is the whole change. */
export const CSP_REPORT_ONLY = true;

export const CSP_REPORT_PATH = '/api/csp-report';

export function cspHeaderName(reportOnly: boolean = CSP_REPORT_ONLY): string {
    return reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';
}
