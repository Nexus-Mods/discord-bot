import { ClientExt } from '../types/DiscordTypes.js';
import { TipCache } from '../types/util.js';

/**
 * The tip cache, created on first use.
 *
 * `if (!client.tipCache) client.tipCache = new TipCache()` was written out at four
 * call sites across two files. One accessor means the lifetime is defined in one
 * place, and it is the obvious hook if this ever needs priming at startup instead.
 */
export function getTipCache(client: ClientExt): TipCache {
    if (!client.tipCache) client.tipCache = new TipCache();
    return client.tipCache;
}
