import { OPTIONAL_SECRETS, REQUIRED_SECRETS } from '@nexusmods/auth/signing.js';
import { logger } from '@nexusmods/core/logger.js';
import type { Env } from '@/lib/security/clientIp';

/**
 * The checks Express made before serving a request.
 *
 * Kept out of instrumentation.ts so it is testable without a server, and because Turbopack
 * statically analyses that file and warns about `process.exit` even inside a runtime guard.
 */

export interface BootProblems {
    /** Required secrets that are absent. Any of these and the site must not serve. */
    missing: { name: string; reason: string }[];
    /** Optional secrets that are absent. The endpoints they guard will reject everything. */
    unguarded: string[];
    /** True when the client address cannot be established and the rate limits merge. */
    proxyUnknown: boolean;
}

/**
 * Required here and not in the bot: the database port is `DBPORT ?? PORT`, and the Next
 * server reads PORT to decide what to listen on. With DBPORT unset, a container told
 * PORT=3000 points its database client at 3000 and fails every query.
 */
const WEB_REQUIRED: ReadonlyArray<{ name: string; reason: string }> = [
    {
        name: 'DBPORT',
        reason: 'PORT is the HTTP port in this process, so the database port has to be named unambiguously',
    },
];

/** Pure. Given an environment, what is wrong with it. */
export function inspectEnvironment(env: Env): BootProblems {
    return {
        missing: [...REQUIRED_SECRETS, ...WEB_REQUIRED]
            .filter(({ name }) => !env[name]).map(({ name, reason }) => ({ name, reason })),
        unguarded: OPTIONAL_SECRETS.filter((name) => !env[name]),
        proxyUnknown: env.NODE_ENV === 'production' && !env.TRUST_PROXY,
    };
}

/**
 * Report, and refuse to run if the site cannot work.
 *
 * Exits rather than throws: Next catches what the instrumentation hook throws and keeps
 * listening, so a misconfigured site would stay up answering 500 to everything.
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

    // Not fatal, but the loudest warning: with no TRUST_PROXY every visitor shares one
    // rate-limit bucket and the first busy one locks out the rest.
    if (problems.proxyUnknown) {
        logger.warn(
            'TRUST_PROXY is not set. Every request will look like it came from the same client, '
            + 'so the rate limits apply to all visitors together rather than to each of them.',
        );
    }
}
