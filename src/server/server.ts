import express from 'express';
import cookieparser from 'cookie-parser';
import {} from 'discord.js';
import * as DiscordOAuth from './DiscordOAuth';
import * as NexusModsOAuth from './NexusModsOAuth';
import { logMessage } from '../api/util';
import { createUser, updateUser, getUserByDiscordId } from '../api/users';
import { NexusUser } from '../types/users';

export class AuthSite {
    private static instance: AuthSite;
    private app = express();
    private port = process.env.AUTH_PORT || 3000;
    public TempStore: Map<string, any> = new Map();

    private constructor() {
        this.initialize();
    }

    static getInstance(): AuthSite {
        if (!AuthSite.instance) {
            AuthSite.instance = new AuthSite();
        }

        return AuthSite.instance;
    }

    private initialize(): void {
        this.app.use(cookieparser(process.env.COOKIE_SECRET));

        this.app.get('/', (req, res) => res.send(`Discord bot OAuth site is online. ${new Date().toLocaleDateString()} ${new Date().toTimeString()}`));

        /**
         * Route configured in the Discord developer console which facilitates the
         * connection between Discord and any additional services you may use. 
         * To start the flow, generate the OAuth2 consent dialog url for Discord, 
         * and redirect the user there.
         */
        this.app.get('/linked-role', this.linkedRole);

        this.app.get('/discord-oauth-callback', this.discordOauthCallback.bind(this));

        this.app.get('/nexus-mods-callback', this.nexusModsOauthCallback.bind(this));

        this.app.get('/oauth-error', (req, res) => res.send('OAuth Error!'));

        this.app.post('/update-metadata', this.updateMetaData.bind(this));

        this.app.listen(this.port, () => logMessage(`Auth website listening on port ${this.port}`));
    }

    linkedRole(req: express.Request, res: express.Response) {
        const { url, state } = DiscordOAuth.getOAuthUrl();
        // logMessage('Redirecting to', url);

          // Store the signed state param in the user's cookies so we can verify
          // the value later. See:
          // https://discord.com/developers/docs/topics/oauth2#state-and-security
        res.cookie('clientState', state, { maxAge: 1000 * 60 * 5, signed: true });
        
        // Send the user to the Discord owned OAuth2 authorization endpoint
        res.redirect(url);
    }

    async discordOauthCallback(req: express.Request, res: express.Response) {
        try {
            const code = req.query['code'];
            const discordState = req.query['state'];

            const { clientState } = req.signedCookies;
            if (clientState != discordState) {
                logMessage('Discord OAuth state verification failed.');
                return res.sendStatus(403);
            }

            const tokens = await DiscordOAuth.getOAuthTokens(code as string);

            const meData = await DiscordOAuth.getUserData(tokens);
            const userId = meData.user.id;
            // Store the Discord token temporarily
            logMessage('Discord user data', meData);
            this.TempStore.set(clientState, { id: userId, name: meData.tag, tokens });

            // Forward to Nexus Mods auth.
            const { url } = NexusModsOAuth.getOAuthUrl(clientState);
            return res.redirect(url);
        }
        catch(err) {
            logMessage('Discord OAuth Error', err, true);
            return res.sendStatus(500);
        }
    }

    async nexusModsOauthCallback(req: express.Request, res: express.Response) {
        // After authing Discord, the user is forwarded to the Nexus Mods auth. 
        const code = req.query['code'];
        const discordState = req.query['state'];

        const { clientState } = req.signedCookies;
        if (clientState != discordState) {
            logMessage('Nexus Mods OAuth state verification failed.');
            return res.sendStatus(403);
        }

        // Get the Discord data from the store
        const discordData = this.TempStore.get(clientState);
        if (!discordData) {
            logMessage('Could not find matching Discord Auth to pair accounts', req.url, true);
            return res.sendStatus(403);
        }
        const existingUser: NexusUser = await getUserByDiscordId(discordData.id);

        try {
            const tokens = await NexusModsOAuth.getOAuthTokens(code as string);
            // logMessage('Got tokens for Nexus Mods', tokens);
            const userData = await NexusModsOAuth.getUserData(tokens);
            logMessage('Got Nexus Mods user data from tokens', {userData, discordData});
            // Work out the expiry time (6 hours at time of writing);
            const user: Partial<NexusUser> = {
                id: parseInt(userData.sub),
                name: userData.name,
                avatar_url: userData.avatar,
                supporter: (userData.membership_roles.includes('supporter') && !userData.membership_roles.includes('premium')),
                premium: userData.membership_roles.includes('premium'),
                modauthor: userData.membership_roles.includes('modauthor'),
                nexus_access: tokens.access_token,
                nexus_refresh: tokens.refresh_token,
                nexus_expires: tokens.expires_at,
                discord_access: discordData.tokens.access_token,
                discord_refresh: discordData.tokens.refresh_token,
                discord_expires: discordData.tokens.expires_at                
            }
            logMessage('User data', user);
            // Store the tokens
            existingUser ? await updateUser(discordData.id, user) : await createUser({ d_id: discordData.id, ...user } as NexusUser);
            await this.updateDiscordMetadata(discordData.id);
            res.send(`${discordData.name} has been linked to ${user.name}! <br/><br/>`+ JSON.stringify(user, null, '</br>'));

        }
        catch(err) {
            logMessage('Nexus Mods OAuth Error', err, true);
            return res.sendStatus(500);
        }

        // Store Nexus Mods tokens

            
        // Push the metadata through to the Discord API (May need to split into a seprate function)

    }

    async updateMetaData(req: express.Request, res: express.Response) {
        try {
            const userId = req.body.userId;
            await this.updateDiscordMetadata(userId);
            res.sendStatus(204);
        }
        catch(err) {
            res.sendStatus(500);
        }
    }

    async updateDiscordMetadata(userId: string) {
        let metadata = {};
        const user: NexusUser = await getUserByDiscordId(userId);
        if (!user) throw new Error('No linked users for this Discord ID.');
        if (!user.discord_access || !user.discord_refresh || !user.discord_expires) {
            throw new Error('No Discord OAuth tokens for this user');
        }
        if (!user.nexus_access || !user.nexus_refresh || !user.nexus_expires) {
            throw new Error('No Nexus Mods OAuth tokens for this user');
        }
        const tokens = { 
            access_token: user.discord_access, 
            refresh_token: user.discord_refresh, 
            expires_at: user.discord_expires 
        };
        try {
            const nexusTokens = {
                access_token: user.nexus_access,
                refresh_token: user.nexus_refresh,
                expires_at: user.nexus_expires
            };
            const accessTokens = await NexusModsOAuth.getAccessToken(nexusTokens);
            const userData = await NexusModsOAuth.getUserData(accessTokens);
            metadata = {
                member: userData.membership_roles.includes('member'),
                modauthor: userData.membership_roles.includes('modauthor'),
                premium: userData.membership_roles.includes('premium'),
                supporter: userData.membership_roles.includes('supporter') && !userData.membership_roles.includes('premium'),
            };

        }
        catch(err) {
            (err as Error).message =  `Error fetching role metadata: ${(err as Error).message}`;
            logMessage(`Error fetching role metadata: ${(err as Error).message}`, err, true);
        }

        await DiscordOAuth.pushMetadata(userId, tokens, metadata);

    }
}