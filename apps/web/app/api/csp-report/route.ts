import { NextResponse } from 'next/server';
import { logger } from '@nexusmods/core/logger.js';
import { readJsonWithLimit } from '@/lib/security/bodyLimit';

/**
 * Where the report-only policy sends its violations - the allowlist in headers.ts was
 * assembled by reading the code, and these reports are how the forgotten host is found.
 *
 * Two shapes arrive: `report-uri` sends `{"csp-report": {...}}`, `report-to` sends an array
 * of `{type, body}`. Both become one warn line, so grepping "CSP violation" is the triage.
 *
 * Unauthenticated by necessity, so treated as hostile: a body cap, nothing echoed back,
 * nothing stored. proxy.ts exempts this path from rate limiting, because a page violating
 * its policy reports per violation.
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
        // Nothing is logged either way: junk here must not be a way to write to the log.
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
