import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The bot's version, read from package.json.
 *
 * Everything used to read `process.env.npm_package_version`, which npm sets only when
 * *it* launches the process. That held while the container ran `npm start`. Phase 1
 * changed the Dockerfile to `CMD ["node", "dist/shards.js"]` so the bot would be PID 1
 * and receive SIGTERM directly - the right fix, but it took the variable with it, and
 * every version display silently became `0.0.0` or `undefined`. Including the
 * `Application-Version` header sent to the Nexus Mods API.
 *
 * Reading package.json does not care how the process was started. The file sits beside
 * `dist/` in the image (`/app/package.json`) and at the repository root in development,
 * so walking up from this module finds it in both.
 */
function resolveVersion(): string {
    let dir = path.dirname(fileURLToPath(import.meta.url));

    for (let depth = 0; depth < 6; depth += 1) {
        try {
            const raw = readFileSync(path.join(dir, 'package.json'), 'utf8');
            const parsed = JSON.parse(raw) as { version?: unknown };
            if (typeof parsed.version === 'string' && parsed.version.length) {
                return parsed.version;
            }
        }
        catch {
            // Not at this level; keep walking up.
        }

        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }

    // Last resorts, in order of how much they can be trusted.
    return process.env.npm_package_version ?? '0.0.0';
}

/** Resolved once at import; package.json does not change under a running process. */
export const BOT_VERSION: string = resolveVersion();
