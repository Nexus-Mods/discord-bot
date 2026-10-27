import crypto from 'node:crypto';
import { readJson } from '@nexusmods/core/http.js';

/**
 * Signing in to the site, as opposed to linking an account.
 *
 * A separate flow from DiscordOAuth.ts on purpose. That one requests
 * `role_connections.write identify` and is registered as the Linked Roles verification
 * URL; adding `guilds` to it would show every existing user a fresh consent screen in the
 * middle of account linking, which is the bot's core feature. Discord accepts a different
 * scope set per authorization request, so this is the same application and client id with
 * its own scopes and its own redirect URI.
 *
 * `identify guilds` is read-only. It can see who the user is and what servers they are
 * in, and it cannot act in any of them.
 */

export const LOGIN_SCOPES = 'identify guilds';

export interface LoginTokens {
    access_token: string;
    token_type?: string;
    expires_in?: number;
    refresh_token?: string;
    scope?: string;
}

export interface DiscordSelf {
    id: string;
    username: string;
    global_name?: string | null;
    avatar: string | null;
}

/** One entry of GET /users/@me/guilds. `permissions` is a bitfield as a decimal string. */
export interface UserGuild {
    id: string;
    name: string;
    icon: string | null;
    owner: boolean;
    permissions: string;
}

/** Unset means the feature is off: no redirect URI registered, no login. */
export function isLoginConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
    return Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET && env.DISCORD_LOGIN_REDIRECT_URI);
}

export function newState(): string {
    return crypto.randomUUID();
}

/**
 * Throws rather than returning an error path. getOAuthUrl in the link flow returns
 * '/oauth-error' because it is reached from a URL Discord owns and cannot be unregistered;
 * this one is reached from a link on our own page, which `isLoginConfigured` hides.
 */
export function getLoginUrl(state: string, env: NodeJS.ProcessEnv = process.env): string {
    if (!isLoginConfigured(env)) throw new Error('Discord login is not configured.');

    const url = new URL('https://discord.com/api/oauth2/authorize');
    url.searchParams.set('client_id', env.DISCORD_CLIENT_ID!);
    url.searchParams.set('redirect_uri', env.DISCORD_LOGIN_REDIRECT_URI!);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', state);
    url.searchParams.set('scope', LOGIN_SCOPES);
    // No prompt=consent: the link flow forces the screen because it needs a fresh grant
    // every time. Signing in should be one click for someone who has already agreed.
    return url.toString();
}

export async function exchangeLoginCode(code: string, env: NodeJS.ProcessEnv = process.env): Promise<LoginTokens> {
    if (!isLoginConfigured(env)) throw new Error('Discord login is not configured.');

    const body = new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID!,
        client_secret: env.DISCORD_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code,
        redirect_uri: env.DISCORD_LOGIN_REDIRECT_URI!,
    });

    const response = await fetch('https://discord.com/api/v10/oauth2/token', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    if (!response.ok) {
        throw new Error(`Error exchanging the Discord login code: [${response.status}] ${response.statusText}`);
    }
    return readJson<LoginTokens>(response);
}

export async function fetchSelf(accessToken: string): Promise<DiscordSelf> {
    const response = await fetch('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
        throw new Error(`Error fetching the Discord user: [${response.status}] ${response.statusText}`);
    }
    return readJson<DiscordSelf>(response);
}

/**
 * The user's guilds, each with the permissions they hold there.
 *
 * Discord caps this at 200 per page and the vast majority of people are nowhere near it,
 * so this is one call rather than a paginated walk. A user in more than 200 servers would
 * see only the first page; `after` is the cursor if that ever needs fixing.
 */
export async function fetchUserGuilds(accessToken: string): Promise<UserGuild[]> {
    const response = await fetch('https://discord.com/api/v10/users/@me/guilds?limit=200', {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
        throw new Error(`Error fetching the user's guilds: [${response.status}] ${response.statusText}`);
    }
    return readJson<UserGuild[]>(response);
}

/** Discord's own revocation endpoint, so signing out ends the grant rather than hiding it. */
export async function revokeLoginToken(accessToken: string, env: NodeJS.ProcessEnv = process.env): Promise<void> {
    if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) return;

    const body = new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        token: accessToken,
        token_type_hint: 'access_token',
    });
    await fetch('https://discord.com/api/v10/oauth2/token/revoke', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
}
