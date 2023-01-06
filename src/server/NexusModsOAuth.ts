import crypto from 'crypto';
import { logMessage } from '../api/util';
import { getModAuthor } from '../api/nexus-discord';

interface OAuthURL {
    url: string;
    state: string;
}

interface OAuthTokens {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    token_type?: string;
    expires_in?: number;
    scope?: string;
}

interface NexusOAuthTokens extends OAuthTokens {
    created_at?: number;
    id_token?: string;
}

type NexusMembershipRoles = 'member' | 'supporter' | 'premium' | 'lifetimepremium' | 'modauthor';

interface NexusUserData {
  sub: string;
  name: string;
  email: string;
  avatar: string;
  group_id: number;
  membership_roles: NexusMembershipRoles[];
}

export function getOAuthUrl(sharedState: string): OAuthURL {
    
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

export async function getOAuthTokens(code: string): Promise<NexusOAuthTokens> {

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
      data.expires_at = Date.now() + (data.expires_in * 1000);
      return data;
    } else {
      throw new Error(`Error fetching OAuth tokens: [${response.status}] ${response.statusText}`);
    }
}

export async function getUserData(tokens: NexusOAuthTokens): Promise<NexusUserData> {
    const url = 'https://users.nexusmods.com/oauth/userinfo';
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });
    if (response.ok) {
      const data = await response.json();
      const modauthor: boolean = await getModAuthor(parseInt(data.sub)).catch(() => false);
      if (modauthor === true) data.membership_roles?.push('modauthor');
      return data;
    } else {
      throw new Error(`Error fetching user data: [${response.status}] ${response.statusText}`);
    }
}

export async function getAccessToken(tokens: OAuthTokens): Promise<OAuthTokens> {
    const { NEXUS_OAUTH_ID, NEXUS_OAUTH_SECRET } = process.env;

    if (!NEXUS_OAUTH_ID || !NEXUS_OAUTH_SECRET) throw new Error('Error getting Discord access token, ENV VARS are undefined.');


    if (Date.now() > tokens.expires_at) {
      logMessage('RENEW NEXUS MODS ACCESS TOKENS', new Date(tokens.expires_at));
      const url = 'https://users.nexusmods.com/oauth/token';
      const body = new URLSearchParams({
        client_id: NEXUS_OAUTH_ID,
        client_secret: NEXUS_OAUTH_SECRET,
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
        return tokens;
      } else {
        throw new Error(`Error refreshing access token: [${response.status}] ${response.statusText}`);
      }
    }
    return tokens;
}

// Revoke tokens
export async function revoke(tokens: OAuthTokens): Promise<OAuthTokens> {
  const { NEXUS_OAUTH_ID, NEXUS_OAUTH_SECRET } = process.env;

  if (!NEXUS_OAUTH_ID || !NEXUS_OAUTH_SECRET) throw new Error('Bot environment variables are not configured properly.');

  const url = 'https://users.nexusmods.com/oauth/token';
  const body = new URLSearchParams({
    client_id: NEXUS_OAUTH_ID,
    client_secret: NEXUS_OAUTH_SECRET,
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
    throw new Error(`Error revoking OAuth tokens: [${response.status}] ${response.statusText}`);
  }
}