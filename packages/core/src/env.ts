import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

/**
 * Load `.env` by walking up from this module, not from `process.cwd()` - the working
 * directory differs between `npm start` at the root, inside apps/bot, and in the image.
 * Nearest wins.
 */

/**
 * Eight, not six: in the web app's standalone build this is bundled into a server chunk,
 * so the walk starts at /app/apps/web/.next/server/chunks and /app/.env is five up.
 */
const MAX_DEPTH = 8;

export function findEnvFile(from: string): string | undefined {
    let dir = from;
    for (let depth = 0; depth < MAX_DEPTH; depth += 1) {
        const candidate = path.join(dir, '.env');
        if (existsSync(candidate)) return candidate;
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    return undefined;
}

/** The file that was loaded, or undefined - not an error, since CI and production may have none. */
export const ENV_FILE: string | undefined = findEnvFile(path.dirname(fileURLToPath(import.meta.url)));

// quiet: dotenv prints a banner otherwise, and production logs are JSON. Values already in
// the environment win, so a container's own variables override the mounted file.
dotenv.config(ENV_FILE ? { path: ENV_FILE, quiet: true } : { quiet: true });
