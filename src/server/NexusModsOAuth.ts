import crypto from 'crypto';
import { baseheader, Logger } from '../api/util';
import { findUser } from '../api/queries/v2-finduser';

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

export function getOAuthUrl(sharedState: string, logger: Logger): OAuthURL {
    
    const state = sharedState ?? crypto.randomUUID();

    const { NEXUS_OAUTH_ID, NEXUS_REDIRECT_URI } = process.env;
    if (!NEXUS_OAUTH_ID || !NEXUS_REDIRECT_URI) {
      logger.warn('Could not generate Nexus Mods OAUTH URL', { NEXUS_OAUTH_ID, NEXUS_REDIRECT_URI });
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
      throw new Error(`Error fetching Nexus Mods OAuth tokens: [${response.status}] ${response.statusText}`);
    }
}

export async function getUserData(tokens: NexusOAuthTokens, logger: Logger): Promise<NexusUserData> {
    const url = 'https://users.nexusmods.com/oauth/userinfo';
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });
    if (response.ok) {
      const data = await response.json();
      let modAuthor = false;
      try {
        const user = await findUser(baseheader, logger,parseInt(data.sub));
        modAuthor = user?.recognizedAuthor ?? false;
      }
      catch(err) {
        logger.warn('Error fetching user data', { error: (err as Error).message, userId: data.sub }, true);
      }
      if (modAuthor === true) data.membership_roles?.push('modauthor');
      return data;
    } else {
      throw new Error(`Error fetching Nexus Mods user data: [${response.status}] ${response.statusText}`);
    }
}

export async function getAccessToken(tokens: OAuthTokens): Promise<OAuthTokens> {
    const { NEXUS_OAUTH_ID, NEXUS_OAUTH_SECRET } = process.env;

    if (!NEXUS_OAUTH_ID || !NEXUS_OAUTH_SECRET) throw new Error('Error getting Discord access token, ENV VARS are undefined.');

    // logMessage('CHECKING NEXUS MODS ACCESS TOKENS', { expires: new Date((tokens.expires_at)), timestamp: tokens.expires_at});

    // Tokens are valid for 6 hours from the point they are issued.
    if (Date.now() > tokens.expires_at) {
      // logMessage('RENEWING NEXUS MODS ACCESS TOKENS', { expires: new Date((tokens.expires_at)) });
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
        tokens.expires_at = Date.now() + (tokens.expires_in * 1000);
        return tokens;
      } else {
        const err: any = new Error(`Could not refresh Nexus Mods access token: [${response.status}] ${response.statusText}`);
        err.code = response.status;
        throw err;
      }
    }
    // logMessage('Tokens are still valid', { expires: new Date((tokens.expires_at)) });
    return tokens;
}

// Revoke tokens
export async function revoke(tokens: OAuthTokens): Promise<OAuthTokens> {
  const { NEXUS_OAUTH_ID, NEXUS_OAUTH_SECRET } = process.env;

  if (!NEXUS_OAUTH_ID || !NEXUS_OAUTH_SECRET) throw new Error('Bot environment variables are not configured properly.');

  const url = 'https://users.nexusmods.com/oauth/revoke';
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
    throw new Error(`Error revoking Neuxs Mods OAuth tokens: [${response.status}] ${response.statusText}`);
  }
}