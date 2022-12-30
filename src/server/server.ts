import express from 'express';
import cookieparser from 'cookie-parser';
import {} from 'discord.js';
import * as util from './util';
import { logMessage } from '../api/util';

export class AuthSite {
    private static instance: AuthSite;
    private app = express();
    private port = process.env.AUTH_PORT || 3000;

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

        this.app.get('/', (req, res) => res.send('Discord bot OAuth site is online.'));

        /**
         * Route configured in the Discord developer console which facilitates the
         * connection between Discord and any additional services you may use. 
         * To start the flow, generate the OAuth2 consent dialog url for Discord, 
         * and redirect the user there.
         */
        this.app.get('/linked-role', this.linkedRole);

        this.app.get('/discord-oauth-callback', this.discordOauthCallback);

        this.app.listen(this.port, () => logMessage(`Auth website listening on port ${this.port}`));
    }

    linkedRole(req: express.Request, res: express.Response) {
        const { url, state } = util.getDiscordOAuthUrl();

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
            // Store the Discord token

            // Perform Nexus Mods auth. (May need to split into a seprate function)

            // Store Nexus Mods tokens

            // Push the metadata through to the Discord API (May need to split into a seprate function)

        }
        catch(err) {
            logMessage('Discord OAuth Error', err, true);
            res.sendStatus(500);
        }
    }
}