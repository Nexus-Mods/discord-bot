import { CDN } from '@discordjs/rest';
import { isLoginConfigured } from '@nexusmods/auth/discordLogin.js';
import { currentSession } from '@/lib/auth/session';

const cdn = new CDN();

/** Discord's default avatar for an account with no custom one. */
function defaultAvatar(id: string): string {
    return cdn.defaultAvatar(Number((BigInt(id) >> 22n) % 6n));
}

export async function SessionBadge() {
    // A header that can throw takes down every page, including /oauth-error - which is
    // where a missing COOKIE_SECRET would otherwise be reported.
    let session = null;
    try { session = await currentSession(); } catch { /* render signed out */ }

    if (!session) {
        return isLoginConfigured()
            ? (
                <a
                    href="/login"
                    className="rounded border border-primary-400 px-3 py-1 text-body-sm font-semibold uppercase tracking-wide text-neutral-50 transition-colors hover:bg-neutral-800"
                >
                    Sign in
                </a>
            )
            : null;
    }

    const avatar = session.avatar
        ? cdn.avatar(session.id, session.avatar, { size: 64 })
        : defaultAvatar(session.id);

    return (
        <div className="flex items-center gap-3">
            <img src={avatar} alt="" width={28} height={28} className="rounded-full" />
            <span className="hidden text-body-sm sm:inline">{session.name}</span>
            <form action="/logout" method="post">
                <button type="submit" className="text-body-xs border rounded p-1 border-amber-600">Sign out</button>
            </form>
        </div>
    );
}