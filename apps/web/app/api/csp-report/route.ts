import { NextResponse } from 'next/server';
import { logger } from '@nexusmods/core/logger.js';
import { readJsonWithLimit } from '@/lib/security/bodyLimit';

/**
 * Where the report-only policy sends its violations.
 *
 * The point of the report-only phase is that the allowlist in headers.ts was assembled by
 * reading the code, and what an allowlist gets wrong is the host nobody remembered. These
 * reports are how that host is found, from real browsers, before the policy starts
 * blocking anything.
 *
 * Two shapes arrive because browsers disagree: `report-uri` sends a single
 * `{"csp-report": {...}}` with content-type application/csp-report, and `report-to` sends
 * an array of `{type, body}` with application/reports+json. Both are normalised to one log
 * line each, at warn, so a grep for "CSP violation" is the whole triage.
 *
 * Unauthenticated by necessity - a browser sends these, and it has no credential to
 * present - so it is treated as hostile input: a body cap, no echo of the content into the
 * response, and only the fields that are useful are logged. It is rate limited by the
 * proxy like everything else, except that the proxy exempts *this* path, because a page
 * that is violating its policy produces a report per violation and throttling them would
 * hide the signal. The cap and the fact that nothing is stored are what keep that safe.
 */
/** Small. A violation report is a few hundred bytes; anything larger is not one. */
const MAX_BYTES = 16 * 1024;

interface Violation {
    'document-uri'?: unknown;
    'violated-directive'?: unknown;
    'effective-directive'?: unknown;
    'blocked-uri'?: unknown;
    disposition?: unknown;
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.length <= 512 ? v : undefined);

function normalise(payload: unknown): Violation[] {
    if (payload && typeof payload === 'object' && 'csp-report' in payload) {
        return [(payload as { 'csp-report': Violation })['csp-report'] ?? {}];
    }
    if (Array.isArray(payload)) {
        return payload
            .filter((r): r is { type?: string; body?: Violation } => !!r && typeof r === 'object')
            .filter((r) => r.type === undefined || r.type === 'csp-violation')
            .map((r) => r.body ?? {});
    }
    return [];
}

export async function POST(request: Request): Promise<NextResponse> {
    const body = await readJsonWithLimit(request, MAX_BYTES);
    if (!body.ok) {
        // 413 for too large, 400 for unparseable. Either way nothing is logged: a flood of
        // junk to this endpoint should not be a way to write to the log.
        return new NextResponse(null, { status: body.status });
    }

    for (const v of normalise(body.value).slice(0, 10)) {
        logger.warn('CSP violation', {
            documentUri: str(v['document-uri']),
            directive: str(v['effective-directive']) ?? str(v['violated-directive']),
            blockedUri: str(v['blocked-uri']),
            disposition: str(v.disposition),
        });
    }

    // 204: the browser is not waiting for anything and there is nothing to say.
    return new NextResponse(null, { status: 204 });
}
