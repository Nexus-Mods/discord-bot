import { packageVersionFrom } from '@nexusmods/core/packageVersion.js';

/**
 * The bot's version, read from its own package.json.
 *
 * The walk moved to @nexusmods/core/packageVersion.js when the Nexus API client needed
 * the same thing for its `Application-Version` header - the history of why it is a walk
 * rather than `process.env.npm_package_version` lives with it there.
 *
 * It stays *here*, in the application, rather than moving into a package: the resolver
 * answers "what is the version of the package this module lives in", and the answer the
 * bot wants is its own. Called from inside @nexusmods/core it would find core's manifest
 * and be right about the wrong package - which is exactly the trap flagged when the
 * cross-cutting package was cut.
 *
 * In the image this module is /app/dist/version.js and the manifest is /app/package.json,
 * one level up. In development it is apps/bot/dist/version.js and apps/bot/package.json.
 */
export const BOT_VERSION: string = packageVersionFrom(import.meta.url);
