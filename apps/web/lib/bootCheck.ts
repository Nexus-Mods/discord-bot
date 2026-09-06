import { OPTIONAL_SECRETS, REQUIRED_SECRETS } from '@nexusmods/auth/signing.js';
import { logger } from '@nexusmods/core/logger.js';
import type { Env } from '@/lib/security/clientIp';

/**
 * What `AuthSite.initialize` checked before Express would serve a request.
 *
 * Kept out of instrumentation.ts so the decision is testable without starting a server -
 * and because Turbopack statically analyses instrumentation.ts for the Edge build and
 * warns about `process.exit` even inside a `NEXT_RUNTIME === 'nodejs'` guard. It does not
 * follow dynamic imports, so the hook importing this is both tidier and quieter.
 */

export interface BootProblems {
    /** Required secrets that are absent. Any of these and the site must not serve. */
    missing: { name: string; reason: string }[];
    /** Optional secrets that are absent. The endpoints they guard will reject everything. */
    unguarded: string[];
    /** True when the client address cannot be established and the rate limits merge. */
    proxyUnknown: boolean;
}

/** Pure. Given an environment, what is wrong with it. */
export function inspectEnvironment(env: Env): BootProblems {
    return {
        missing: REQUIRED_SECRETS.filter(({ name }) => !env[name]).map(({ name, reason }) => ({ name, reason })),
        unguarded: OPTIONAL_SECRETS.filter((name) => !env[name]),
        proxyUnknown: env.NODE_ENV === 'production' && !env.TRUST_PROXY,
    };
}

/**
 * Report, and refuse to run if the site cannot work.
 *
 * Exits rather than throws. Express got the same property for free - AuthSite's
 * constructor threw, nothing caught it, the process died, the container exited non-zero
 * and `restart: unless-stopped` made a bad deploy visible. Next catches whatever the
 * instrumentation hook throws, logs "Failed to prepare server", and keeps listening, so a
 * misconfigured site stays up answering 500 to every request and a port check calls it
 * healthy. Verified before this was written: throwing did exactly that.
 */
export function runBootCheck(env: Env = process.env): void {
    const problems = inspectEnvironment(env);

    if (problems.missing.length > 0) {
        for (const { name, reason } of problems.missing) {
            logger.error(`${name} is not set. ${reason}, so the site cannot start.`);
        }
        process.exit(1);
    }

    for (const name of problems.unguarded) {
        logger.warn(`${name} is not set - the endpoints it guards will reject every request.`);
    }

    /**
     * Not fatal, but the loudest warning here.
     *
     * With no TRUST_PROXY the client address cannot be established, every visitor shares
     * one rate-limit bucket, and the first busy one locks out the rest. Express had the
     * same failure and no warning for it: `req.ip` quietly became the proxy's address.
     */
    if (problems.proxyUnknown) {
        logger.warn(
            'TRUST_PROXY is not set. Every request will look like it came from the same client, '
            + 'so the rate limits apply to all visitors together rather than to each of them.',
        );
    }
}
