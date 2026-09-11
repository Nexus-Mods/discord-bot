import type { NextResponse } from 'next/server';
import { text } from '@/lib/machineRoute';
import { redirectTo } from '@/lib/link/flow';

/**
 * GET /nxm - turn a web link into an nxm:// link the mod manager can open.
 *
 * Used by the bot's embeds: Discord will not render a custom-scheme link, so the button
 * points here and this redirects. There is nothing to authenticate; every input is in the
 * query string and the output is a URL in a fixed scheme.
 *
 * The segments are percent-encoded on the way in, which Express does not do. Every real
 * value - a game domain, a collection slug, a numeric id - is unchanged by encoding, so no
 * working link behaves differently; what it stops is a crafted `domain` with a slash in it
 * rewriting the rest of the path, which is the standard shape of a bug in a redirect built
 * out of user input by string concatenation.
 */
export async function GET(request: Request): Promise<NextResponse> {
    const params = new URL(request.url).searchParams;
    const type = params.get('type');
    const segment = (name: string): string => encodeURIComponent(params.get(name) ?? '');

    if (type === 'collection') {
        const domain = params.get('domain');
        const slug = params.get('slug');
        if (!domain || !slug) return text('Domain or slug not provided', 400);
        // `rev` is optional and defaults to the newest revision.
        const rev = params.get('rev') ? segment('rev') : 'latest';
        return redirectTo(`nxm://${segment('domain')}/collections/${segment('slug')}/revisions/${rev}`);
    }

    if (type === 'mod') {
        const domain = params.get('domain');
        const modId = params.get('mod_id');
        const fileId = params.get('file_id');
        if (!domain || !modId || !fileId) return text('Game, mod or file ID not provided', 400);
        return redirectTo(`nxm://${segment('domain')}/mods/${segment('mod_id')}/files/${segment('file_id')}`);
    }

    // Express reached this having already sent nothing, and the request hung until the
    // client gave up. Fixed there in 4.4.0; stated here as the same message.
    return text('Unrecognised link type. Expected "mod" or "collection".', 400);
}
