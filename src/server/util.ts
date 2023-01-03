// import config from './config';
import crypto from 'crypto';
import { logMessage } from '../api/util';

interface OAuthTokens {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

interface OAuthURL {
  url: string;
  state: string;
}

export function getDiscordOAuthUrl(): OAuthURL {
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

export async function getDiscordOAuthTokens(code: string): Promise<OAuthTokens> {
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
      return data;
    } else {
      throw new Error(`Error fetching OAuth tokens: [${response.status}] ${response.statusText}`);
    }
}

export async function getDiscordUserData(tokens: { access_token: string, refresh_token: string, expires_in: number }) {
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
export async function pushDiscordMetadata(userId: string, tokens: any, metadata: any): Promise<void> {

    const { DISCORD_CLIENT_ID } = process.env;
    if (!DISCORD_CLIENT_ID) throw new Error('Cannot push Discord metadata, ENVARS invalid');
    // GET/PUT /users/@me/applications/:id/role-connection
    const url = `https://discord.com/api/v10/users/@me/applications/${DISCORD_CLIENT_ID}/role-connection`;
    const accessToken = await getAccessToken(userId, tokens);
    const body = {
      platform_name: 'Example Linked Role Discord Bot',
      metadata,
    };
    const response = await fetch(url, {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`Error pushing discord metadata: [${response.status}] ${response.statusText}`);
    }
}

/**
 * The initial token request comes with both an access token and a refresh
 * token.  Check if the access token has expired, and if it has, use the
 * refresh token to acquire a new, fresh access token.
 */
export async function getAccessToken(userId: string, tokens: { refresh_token: string, access_token: string, expires_at: number }) {
    const { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET } = process.env;

    if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) throw new Error('Error getting Discord access token, ENV VARS are undefined.');


    if (Date.now() > tokens.expires_at) {
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
        tokens.access_token = tokens.access_token;
        tokens.expires_at = Date.now() + tokens.expires_in * 1000;
        // await storage.storeDiscordTokens(userId, tokens);
        return tokens.access_token;
      } else {
        throw new Error(`Error refreshing access token: [${response.status}] ${response.statusText}`);
      }
    }
    return tokens.access_token;
  }

export function getNexusModsOAuthUrl(sharedState: string): OAuthURL {
    
    const state = sharedState ?? crypto.randomUUID();

    const { NEXUS_OAUTH_ID, NEXUS_REDIRECT_URI } = process.env;
    if (!NEXUS_OAUTH_ID || !NEXUS_REDIRECT_URI) {
      logMessage('Could not generate Nexus Mods OAUTH URL', { NEXUS_OAUTH_ID, NEXUS_REDIRECT_URI }, true);
      return { url: '/oauth-error', state };
    };
  
    const url = new URL('https://users.nexusmods.com/oauth/authorize');
    url.searchParams.set('client_id', NEXUS_OAUTH_ID);
    url.searchParams.set('redirect_uri', NEXUS_REDIRECT_URI);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', state);
    url.searchParams.set('scope', 'openid email profile');
    // url.searchParams.set('approval_prompt', 'auto'); // Skips the auth prompt?
    return { state, url: url.toString() };
}

interface NexusOAuthTokens extends OAuthTokens {
  created_at: number;
  id_token: string;
}

export async function getNexusModsOAuthTokens(code: string): Promise<NexusOAuthTokens> {

  const { NEXUS_OAUTH_ID, NEXUS_OAUTH_SECRET, NEXUS_REDIRECT_URI } = process.env;
    if (!NEXUS_OAUTH_ID || !NEXUS_REDIRECT_URI || !NEXUS_OAUTH_SECRET) throw new Error('Cannot get Nexus Mods OAuth Tokens, ENVARs invalid');

  const url = 'https://users.nexusmods.com/oauth/token';
  const body = new URLSearchParams({
    client_id: NEXUS_OAUTH_ID,
    client_secret: NEXUS_OAUTH_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: NEXUS_REDIRECT_URI,
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
    return data;
  } else {
    throw new Error(`Error fetching OAuth tokens: [${response.status}] ${response.statusText}`);
  }
}

type NexusMembershipRoles = 'member' | 'supporter' | 'premium' | 'lifetimepremium';

interface NexusUserData {
  sub: string;
  name: string;
  email: string;
  avatar: string;
  group_id: number;
  membership_roles: NexusMembershipRoles[];
}

export async function getNexusModsUserData(tokens: { access_token: string, refresh_token: string, expires_in: number }): Promise<NexusUserData> {
  const url = 'https://users.nexusmods.com/oauth/userinfo';
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