import config from './config';
import crypto from 'crypto';

export function getDiscordOAuthUrl() {
    const state = crypto?.randomUUID() || 'test';

    console.log('config', config);
  
    const url = new URL('https://discord.com/api/oauth2/authorize');
    url.searchParams.set('client_id', config.DISCORD_CLIENT_ID || process.env.DISCORD_CLIENT_ID);
    url.searchParams.set('redirect_uri', config.DISCORD_REDIRECT_URI || process.env.DISCORD_REDIRECT_URI);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', state);
    url.searchParams.set('scope', 'role_connections.write identify');
    url.searchParams.set('prompt', 'consent');
    return { state, url: url.toString() };
}

export async function getDiscordOAuthTokens(code: string) {
    const url = 'https://discord.com/api/v10/oauth2/token';
    const body = new URLSearchParams({
      client_id: config.DISCORD_CLIENT_ID,
      client_secret: config.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.DISCORD_REDIRECT_URI,
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
export async function pushDiscordMetadata(userId: string, tokens: any, metadata: any) {
    // GET/PUT /users/@me/applications/:id/role-connection
    const url = `https://discord.com/api/v10/users/@me/applications/${config.DISCORD_CLIENT_ID}/role-connection`;
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
    if (Date.now() > tokens.expires_at) {
      const url = 'https://discord.com/api/v10/oauth2/token';
      const body = new URLSearchParams({
        client_id: config.DISCORD_CLIENT_ID,
        client_secret: config.DISCORD_CLIENT_SECRET,
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

export function getNexusModsOAuthUrl(sharedState: string) {
    const state = sharedState ?? crypto.randomUUID();
  
    const url = new URL('https://users.nexusmods.com/oauth/authorize');
    url.searchParams.set('client_id', config.NEXUS_OAUTH_ID);
    url.searchParams.set('redirect_uri', config.NEXUS_REDIRECT_URI);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', state);
    url.searchParams.set('scope', 'openid+email+profile');
    // url.searchParams.set('approval_prompt', 'auto'); // Skips the auth prompt?
    return { state, url: url.toString() };
}

export async function getNexusModsOAuthTokens(code: string) {
  const url = 'https://users.nexusmods.com/oauth/token';
  const body = new URLSearchParams({
    client_id: config.NEXUS_OAUTH_ID,
    client_secret: config.NEXUS_OAUTH_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.NEXUS_REDIRECT_URI,
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

export async function getNexusModsUserData(tokens: { access_token: string, refresh_token: string, expires_in: number }) {
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