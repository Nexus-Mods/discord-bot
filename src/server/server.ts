import express from 'express';
import cookieparser from 'cookie-parser';
import {} from 'discord.js';
import * as util from './util';
import { logMessage } from '../api/util';
import { createUser } from '../api/users';
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

        this.app.listen(this.port, () => logMessage(`Auth website listening on port ${this.port}`));
    }

    linkedRole(req: express.Request, res: express.Response) {
        const { url, state } = util.getDiscordOAuthUrl();
        logMessage('Redirecting to', url);

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

            const tokens = await util.getDiscordOAuthTokens(code as string);

            const meData = await util.getDiscordUserData(tokens);
            const userId = meData.user.id;
            // Store the Discord token temporarily
            this.TempStore.set(clientState, { id: userId, tokens });

            // Forward to Nexus Mods auth.
            const { url } = util.getNexusModsOAuthUrl(clientState);
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

        try {
            const tokens = await util.getNexusModsOAuthTokens(code as string);
            // logMessage('Got tokens for Nexus Mods', tokens);
            const userData = await util.getNexusModsUserData(tokens);
            logMessage('Got Nexus Mods user data from tokens', {userData, discordData});
            const nexus_expires = new Date(new Date().getTime() + (tokens.expires_in * 1000));

            const user: NexusUser = {
                d_id: discordData.id,
                id: userData.sub,
                name: userData.name,
                apikey: '',
                avatar_url: userData.avatar,
                supporter: (userData.membership_roles.includes('supporter') && userData.membership_roles.includes('premium')),
                premium: userData.membership_roles.includes('premium'),
                modauthor: false,
                nexus_access: tokens.access_token,
                nexus_refresh: tokens.refresh_token,
                nexus_expires                
            }
            // createUser()
            res.send(JSON.stringify(user, null, 2));

        }
        catch(err) {
            logMessage('Nexus Mods OAuth Error', err, true);
            return res.sendStatus(500);
        }

        // Store Nexus Mods tokens

            
        // Push the metadata through to the Discord API (May need to split into a seprate function)

    }
}