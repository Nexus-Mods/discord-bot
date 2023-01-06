import crypto from 'crypto';
import { logMessage } from '../api/util';

interface OAuthURL {
    url: string;
    state: string;
}

interface OAuthTokens {
    access_token: string;
    token_type?: string;
    expires_at: number;
    expires_in?: number;
    refresh_token: string;
    scope?: string;
}

interface DiscordUserData {
  application: {
    id: string;
    name: string;
    icon: string;
    description: string;
    summary: string;
    type: any;
    hook: boolean;
    guild_id: string;
  }
  scopes: string[];
  expires: Date;
  user: {
    id: string;
    username: string;
    avatar: string;
    avatar_decoration: string | null;
    discriminator: string;
    public_flags: number;
  }
}

interface BotMetaData {
  member?: '0' | '1';
  modauthor?: '0' | '1';
  premium?: '0' | '1';
  supporter?: '0' | '1';
}

export function getOAuthUrl(): OAuthURL {
    const state = crypto?.randomUUID() || 'test';

    if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_REDIRECT_URI) return { url: '/oauth-error', state };
  
    const url = new URL('https://discord.com/api/oauth2/authorize');
    url.searchParams.set('client_id', process.env.DISCORD_CLIENT_ID);
    url.searchParams.set('redirect_uri', process.env.DISCORD_REDIRECT_URI);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', state);
    url.searchParams.set('scope', 'role_connections.write identify');
    url.searchParams.set('prompt', 'consent');
    return { state, url: url.toString() };
}

export async function getOAuthTokens(code: string): Promise<OAuthTokens> {
    const {DISCORD_CLIENT_ID,DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI } = process.env;
  
    if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !DISCORD_REDIRECT_URI) throw new Error('Bot environment variables are not configured properly.');

    const url = 'https://discord.com/api/v10/oauth2/token';
    const body = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: DISCORD_REDIRECT_URI,
    });
  
    const response = await fetch(url, {
      body,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    if (response.ok) {
      const data = await response.json();
      data.expires_at = Date.now() + (data.expires_in * 1000);
      return data;
    } else {
      throw new Error(`Error fetching OAuth tokens: [${response.status}] ${response.statusText}`);
    }
}

export async function getUserData(tokens: OAuthTokens): Promise<DiscordUserData> {
    const url = 'https://discord.com/api/v10/oauth2/@me';
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });
    if (response.ok) {
      const data = await response.json();
      return data;
    } else {
      throw new Error(`Error fetching user data: [${response.status}] ${response.statusText}`);
    }
}


/**
 * Given metadata that matches the schema, push that data to Discord on behalf
 * of the current user.
 */
export async function pushMetadata(userId: string, username: string, tokens: OAuthTokens, metadata: BotMetaData): Promise<void> {

    const { DISCORD_CLIENT_ID } = process.env;
    if (!DISCORD_CLIENT_ID) throw new Error('Cannot push Discord metadata, ENVARS invalid');
    // GET/PUT /users/@me/applications/:id/role-connection
    const url = `https://discord.com/api/v10/users/@me/applications/${DISCORD_CLIENT_ID}/role-connection`;
    const accessTokens = await getAccessToken(userId, tokens);
    const body = {
      platform_name: 'Nexus Mods',
      platform_username: username,
      metadata,
    };
    const response = await fetch(url, {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: {
        Authorization: `Bearer ${accessTokens.access_token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`Error pushing discord metadata: [${response.status}] ${response.statusText}. Token: ${accessTokens.access_token}`);
    }
}

/**
 * Fetch the metadata currently pushed to Discord for the currently logged
 * in user, for this specific bot.
 */
export async function getMetadata(userId: string, tokens: OAuthTokens) {
  // GET/PUT /users/@me/applications/:id/role-connection
  const { DISCORD_CLIENT_ID } = process.env;
  const url = `https://discord.com/api/v10/users/@me/applications/${DISCORD_CLIENT_ID}/role-connection`;
  const accessToken = await getAccessToken(userId, tokens);
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken.access_token}`,
    },
  });
  if (response.ok) {
    const data = await response.json();
    return data;
  } else {
    throw new Error(`Error getting discord metadata: [${response.status}] ${response.statusText}`);
  }
}

/**
 * The initial token request comes with both an access token and a refresh
 * token.  Check if the access token has expired, and if it has, use the
 * refresh token to acquire a new, fresh access token.
 */
export async function getAccessToken(userId: string, tokens: OAuthTokens): Promise<OAuthTokens> {
    const { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET } = process.env;

    if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) throw new Error('Error getting Discord access token, ENV VARS are undefined.');


    if (Date.now() > tokens.expires_at) {
      logMessage('RENEW DISCORD ACCESS TOKENS', new Date(tokens.expires_at));
      const url = 'https://discord.com/api/v10/oauth2/token';
      const body = new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
      });
      const response = await fetch(url, {
        body,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      if (response.ok) {
        const tokens = await response.json();
        // tokens.access_token = tokens.access_token;
        tokens.expires_at = Date.now() + tokens.expires_in * 1000;
        return tokens;
      } else {
        throw new Error(`Error refreshing access token: [${response.status}] ${response.statusText}`);
      }
    }
    return tokens;
}

// Revoke tokens
export async function revoke(tokens: OAuthTokens): Promise<OAuthTokens> {
  const {DISCORD_CLIENT_ID,DISCORD_CLIENT_SECRET } = process.env;

  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) throw new Error('Bot environment variables are not configured properly.');

  const url = 'https://discord.com/api/oauth2/token/revoke';
  const body = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    client_secret: DISCORD_CLIENT_SECRET,
    token: tokens.refresh_token,
  });

  const response = await fetch(url, {
    body,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  if (response.ok) {
    const data = await response.json();
    data.expires_at = Date.now() + (data.expires_in * 1000);
    return data;
  } else {
    throw new Error(`Error revoking Discord OAuth tokens: [${response.status}] ${response.statusText}`);
  }
}