import express from 'express';
import cookieparser from 'cookie-parser';
import * as DiscordOAuth from './DiscordOAuth';
import * as NexusModsOAuth from './NexusModsOAuth';
import { logMessage } from '../api/util';
import { createUser, updateUser, getUserByDiscordId, deleteUser, getUserByNexusModsId } from '../api/users';
import { NexusUser } from '../types/users';
import path from 'path';

export class AuthSite {
    private static instance: AuthSite;
    private app = express();
    private port = process.env.AUTH_PORT || 3000;
    public TempStore: Map<string, { name: string, id: string, tokens: any }> = new Map();

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
        this.app.set('views', path.join(__dirname, 'views'));
        this.app.use(express.static(path.join(__dirname, 'public')));
        this.app.set('view engine', 'ejs');

        this.app.get('/', (req, res) => { 
            // Readme icon from https://www.iconfinder.com/icons/9113356/readme_icon
            res.render('index', { timestamp: `${new Date().toLocaleDateString()} ${new Date().toTimeString()}`, pageTitle: undefined });
        });

        this.app.get('/success', this.success.bind(this));

        /**
         * Route configured in the Discord developer console which facilitates the
         * connection between Discord and any additional services you may use. 
         * To start the flow, generate the OAuth2 consent dialog url for Discord, 
         * and redirect the user there.
         */
        this.app.get('/linked-role', this.linkedRole);

        this.app.get('/discord-oauth-callback', this.discordOauthCallback.bind(this));

        this.app.get('/nexus-mods-callback', this.nexusModsOauthCallback.bind(this));

        this.app.get('/oauth-error', this.linkError.bind(this));

        this.app.get('/unlink-error', this.unlinkError.bind(this));

        this.app.post('/update-metadata', this.updateMetaData.bind(this));

        this.app.get('/show-metadata', this.showMetaData.bind(this));
        
        this.app.get('/revoke', this.revokeAccess.bind(this));

        this.app.get('*', (req, res) => res.redirect('/'));

        this.app.listen(this.port, () => logMessage(`Auth website listening on port ${this.port}`));
    }

    success(req: express.Request, res: express.Response) {
        const discord = req.query['discord'] || 'UnknownDiscordUser';
        const discordId = req.query['d_id'] || '0';
        const nexus = req.query['nexus'] || 'UnknownNexusModsUser';
        const nexusId = req.query['n_id'] || '0';
        res.render('success', { 
            discord, 
            nexus,
            discordId,
            nexusId,
            pageTitle: 'Success!'
        });
    }

    linkError(req: express.Request, res: express.Response) {
        // We'll set the error info as a cookie and pull it out as needed.
        // retry icon https://www.iconfinder.com/icons/3229643/material_designs_refresh_retry_icon
        const { ErrorDetail } = req.signedCookies;
        res.render('linkerror', { error: ErrorDetail || 'No error recorded. Are you blocking cookies?', pageTitle: 'Authentication Error' });
    }

    unlinkError(req: express.Request, res: express.Response) {
        // We'll set the error info as a cookie and pull it out as needed.
        // retry icon https://www.iconfinder.com/icons/3229643/material_designs_refresh_retry_icon
        const { ErrorDetail } = req.signedCookies;
        res.render('unlinkerror', { error: ErrorDetail || 'No error recorded. Are you blocking cookies?', pageTitle: 'Unlinking Error' });
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
            this.TempStore.set(clientState, { id: userId, name: `${meData.user.username}#${meData.user.discriminator}`, tokens });

            // Forward to Nexus Mods auth.
            const { url } = NexusModsOAuth.getOAuthUrl(clientState);
            return res.redirect(url);
        }
        catch(err) {
            logMessage('Discord OAuth Error', err, true);
            res.cookie('ErrorDetail', `Discord OAuth Error: ${(err as Error).message}`, { maxAge: 1000 * 60 * 2, signed: true });
            res.redirect('/oauth-error');
            // return res.sendStatus(500);
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
            if (!existingUser) {
                const nexusUser = await getUserByNexusModsId(parseInt(userData.sub));
                if (!!nexusUser) {
                    // If their Discord is linked to another account, remove that link. 
                    logMessage('Deleting link to a different Discord account!', { user: nexusUser.name, discord: nexusUser.d_id });
                    try {
                    if (!!nexusUser.nexus_access && !!nexusUser.nexus_refresh && !!nexusUser.nexus_expires) 
                        await NexusModsOAuth.revoke({ access_token: nexusUser.nexus_access, refresh_token: nexusUser.nexus_refresh, expires_at: nexusUser.nexus_expires });
                    if (!!nexusUser.discord_access && !!nexusUser.discord_refresh && !!nexusUser.discord_expires) 
                        await DiscordOAuth.revoke({ access_token: nexusUser.discord_access, refresh_token: nexusUser.discord_refresh, expires_at: nexusUser.discord_expires });
                    }
                    catch(err) { logMessage('Error revoking tokens for alternate account', err, true); }
                    await deleteUser(nexusUser.d_id);
                }
            }

            // logMessage('Got Nexus Mods user data from tokens', {userData, discordData});
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
            // Store the tokens
            // logMessage('Pushing user data to database', { update: !!existingUser, name: user.name });
            const updatedUser = !!existingUser ? await updateUser(discordData.id, user) : await createUser({ d_id: discordData.id, ...user } as NexusUser);
            await this.updateDiscordMetadata(discordData.id, updatedUser);
            logMessage('OAuth Account link success', { discord: discordData.name, nexusMods: user.name });
            const successUrl = '/success'
            +`?nexus=${encodeURIComponent(user.name || '')}`
            +`&n_id=${encodeURIComponent(user.id?.toString() || '0')}`
            +`&discord=${encodeURIComponent(discordData.name)}`
            +`&d_id=${encodeURIComponent(discordData.id)}`;

            res.redirect(successUrl);
            // res.send(`${discordData.name} has been linked to ${user.name}! <br/><br/>`));

        }
        catch(err) {
            logMessage('Nexus Mods OAuth Error', err, true);
            res.cookie('ErrorDetail', `Neuxs Mods OAuth Error: ${(err as Error).message}`, { maxAge: 1000 * 60 * 2, signed: true });
            res.redirect('/oauth-error');
            // return res.sendStatus(500);
        }
    }

    async updateMetaData(req: express.Request, res: express.Response) {
        try {
            const userId = req.body.userId;
            await this.updateDiscordMetadata(userId);
            res.sendStatus(204);
        }
        catch(err) {
            // res.cookie('ErrorDetail', `Error pushing role metadata to Discord: ${(err as Error).message}`, { maxAge: 1000 * 60 * 2, signed: true });
            // res.redirect('/oauth-error');
            logMessage('Error in update-meta endpoint', err, true);
            res.sendStatus(500);
        }
    }

    async showMetaData(req: express.Request, res: express.Response) {
        try {
            const id = req.query['id'];
            if (!id) throw new Error('ID not sent');
            const user = await getUserByDiscordId(id as string);
            if (!user.discord_access || !user.discord_expires || !user.discord_refresh) throw new Error('Invalid Discord OAuth Data');
            const tokens = { access_token: user.discord_access, refresh_token: user.discord_refresh, expires_at: user.discord_expires };
            const meta = await DiscordOAuth.getMetadata((id as string),tokens);
            res.send(JSON.stringify(meta, null, '</br>'));
            
        }
        catch(err) {
            res.cookie('ErrorDetail', `Error getting metadata: ${(err as Error).message}`, { maxAge: 1000 * 60 * 2, signed: true });
            res.redirect('/oauth-error');
        }
        
    }

    async updateDiscordMetadata(userId: string, user?: NexusUser) {
        let metadata = {};
        if (!user) user = await getUserByDiscordId(userId);
        if (!user) throw new Error('No linked users for this Discord ID.');
        if (!user.discord_access || !user.discord_refresh || !user.discord_expires) {
            throw new Error('No Discord OAuth tokens for this user:'+user.name);
        }
        if (!user.nexus_access || !user.nexus_refresh || !user.nexus_expires) {
            throw new Error('No Nexus Mods OAuth tokens for this user:'+user.name);
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
            // The Discord Metadata API is super janky and accepts INTs but not True/False.
            metadata = {
                member: userData.membership_roles.includes('member') ? 1 : 0,
                modauthor: userData.membership_roles.includes('modauthor')? 1 : 0,
                premium: userData.membership_roles.includes('premium') ? 1 : 0,
                supporter: (userData.membership_roles.includes('supporter') && !userData.membership_roles.includes('premium')) ? 1 : 0,
            };

        }
        catch(err) {
            // (err as Error).message =  `Error updating role metadata: ${(err as Error).message}`;
            logMessage(`Error updating role metadata: [[${(err as Error).message}]]`, err, true);
        }

        await DiscordOAuth.pushMetadata(userId, user.name, tokens, metadata);

    }

    async revokeAccess(req: express.Request, res: express.Response) {
        try {
            const id: string = req.query['id'] as string;
            if (!id) throw new Error('Discord ID parameter was not supplied.');
            const user = await getUserByDiscordId(id);
            if (!user) throw new Error(`No links exist for the Discord ID ${id}`);
            // Revoke Discord tokens
            if (!!user.discord_access && !!user.discord_expires && !!user.discord_refresh) {
                const discordTokens = { access_token: user.discord_access, refresh_token: user.discord_refresh, expires_at: user.discord_expires };
                await DiscordOAuth.revoke(discordTokens);
            }
            else logMessage('No Discord Tokens to revoke', user.name);
            // Revoke Nexus Mods tokens
            if (!!user.nexus_access && !!user.nexus_expires && !!user.nexus_refresh) {
                const nexusTokens = { access_token: user.nexus_access, refresh_token: user.nexus_refresh, expires_at: user.nexus_expires };
                await NexusModsOAuth.revoke(nexusTokens);
            }
            else logMessage('No Nexus Mods Tokens to revoke', user.name);

            // Delete from database
            // await deleteUser(id);
            await updateUser(id, 
                { 
                    nexus_access: undefined, 
                    nexus_expires: undefined, 
                    nexus_refresh: undefined, 
                    discord_access: undefined, 
                    discord_expires: undefined, 
                    discord_refresh: undefined 
            });
            logMessage('Revoke successful for user', user.name);
            // res.send('Revoke complete!');
            res.render('revoked', { pageTitle: 'Link Removed' });
        }
        catch(err) {
            logMessage('Error removing account link', err, true);
            res.cookie('ErrorDetail', `Error unlinking accounts: ${(err as Error).message}`, { maxAge: 1000 * 60 * 2, signed: true });
            res.redirect('/unlink-error');
        }
        
    }
}