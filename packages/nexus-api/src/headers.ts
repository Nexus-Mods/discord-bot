import { packageVersionFrom } from '@nexusmods/core/packageVersion.js';

/**
 * The headers every call to the Nexus Mods API carries.
 *
 * These were `baseheader` in apps/bot/src/api/util.ts, built from BOT_VERSION. They are
 * here now because the account model had to become a package - the two admin metadata
 * endpoints need it, and it is the only thing they need that was not already one - and
 * `baseheader` was the single import holding it in the application. A package cannot
 * resolve the application's version: walk up from inside one and you find its own
 * manifest.
 *
 * So `Application-Version` names the API client rather than the bot. Today that is the
 * same string, because every workspace here is 5.0.0 and an architecture test keeps them
 * in lockstep - if that test ever fails, this header is one of the things it is failing
 * about. The alternative was threading a headers argument through DiscordBotUser's
 * constructor and thirteen call sites to carry a value that has never differed.
 *
 * `Application-Name` is unchanged and is the part Nexus Mods actually identifies traffic
 * by, so nothing on their side sees a new caller.
 *
 * Every query function in this package already takes headers as its first argument. This
 * is the default they were always being passed, and it is not special: a caller with a
 * reason to send something else still can.
 */
export const baseheader: Readonly<Record<string, string>> = {
    'Application-Name': 'Nexus Mods Discord Bot',
    'Application-Version': packageVersionFrom(import.meta.url),
};
