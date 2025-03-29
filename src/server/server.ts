import express from 'express';
import cookieparser from 'cookie-parser';
import * as DiscordOAuth from './DiscordOAuth';
import * as NexusModsOAuth from './NexusModsOAuth';
import { logMessage } from '../api/util';
import { createUser, updateUser, getUserByDiscordId, deleteUser, getUserByNexusModsId } from '../api/users';
import { NexusUser } from '../types/users';
import path from 'path';
import { DiscordBotUser } from '../api/DiscordBotUser';
import { ClientExt } from '../types/DiscordTypes';
import { getSubscriptionsByChannel } from '../api/subscriptions';
import { fileURLToPath } from 'url';

// Get the equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class AuthSite {
    private static instance: AuthSite;
    private app = express();
    private client: ClientExt;
    private port = process.env.AUTH_PORT || 3000;
    public TempStore: Map<string, { name: string, id: string, tokens: any }> = new Map();

    private constructor(client: ClientExt) {
        this.client = client;
        if (client.shard && client.shard.ids[0] !== 0) logMessage('Skipping AuthSite initialization, not on shard 0', undefined, true);
        else this.initialize();
    }

    static getInstance(client: ClientExt): AuthSite {
        if (!AuthSite.instance) {
            AuthSite.instance = new AuthSite(client);
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
            res.render('index', 
                { 
                    timestamp: `${new Date().toLocaleDateString('en-GB')} ${new Date().toTimeString()}`, 
                    pageTitle: undefined, 
                    clientId: process.env.DISCORD_CLIENT_ID,
                    version: process.env.npm_package_version ?? '0.0.0',
                }
            );
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
        
        this.app.get('/beacon', this.beaconTest.bind(this));

        this.app.get('/tracking', this.tracking.bind(this));

        this.app.get('/nxm', this.nxmForward.bind(this));

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
        res.statusCode = 500;
        res.render('linkerror', { error: ErrorDetail || 'No error recorded. Are you blocking cookies?', pageTitle: 'Authentication Error' });
    }

    unlinkError(req: express.Request, res: express.Response) {
        // We'll set the error info as a cookie and pull it out as needed.
        // retry icon https://www.iconfinder.com/icons/3229643/material_designs_refresh_retry_icon
        const { ErrorDetail } = req.signedCookies;
        res.statusCode = 500;
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
                res.sendStatus(403);
                return;
            }

            const tokens = await DiscordOAuth.getOAuthTokens(code as string);

            const meData = await DiscordOAuth.getUserData(tokens);
            const userId = meData.user.id;
            // Store the Discord token temporarily
            this.TempStore.set(clientState, { id: userId, name: `${meData.user.username}#${meData.user.discriminator}`, tokens });

            // Forward to Nexus Mods auth.
            const { url } = NexusModsOAuth.getOAuthUrl(clientState);
            res.redirect(url);
        }
        catch(err) {
            logMessage('Discord OAuth Error', err, true);
            res.cookie('ErrorDetail', `Discord OAuth Error: ${(err as Error).message}`, { maxAge: 1000 * 60 * 2, signed: true });
            return res.redirect('/oauth-error');
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
            res.sendStatus(403);
            return;
        }

        // Get the Discord data from the store
        const discordData = this.TempStore.get(clientState);
        if (!discordData) {
            logMessage('Could not find matching Discord Auth to pair accounts', req.url, true);
            res.sendStatus(403);
            return;
        }

        try {
            const existingUser: DiscordBotUser|undefined = await getUserByDiscordId(discordData.id);
            const tokens = await NexusModsOAuth.getOAuthTokens(code as string);
            // logMessage('Got tokens for Nexus Mods', tokens);
            const userData = await NexusModsOAuth.getUserData(tokens);
            if (!existingUser) {
                const nexusUser = await getUserByNexusModsId(parseInt(userData.sub));
                // logMessage('Existing Nexus Mods user lookup', nexusUser?.NexusModsUsername);
                if (!!nexusUser) {
                    // If their Discord is linked to another account, remove that link. 
                    logMessage('Deleting link to a different Discord account!', { user: nexusUser.NexusModsUsername, discord: nexusUser.DiscordId });
                    try {
                        await nexusUser.Discord.Revoke();
                        await nexusUser.NexusMods.Revoke();
                    }
                    catch(err) { logMessage('Error revoking tokens for alternate account', err, true); }
                    await deleteUser(nexusUser.DiscordId);
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
                apikey: undefined,
                discord_access: discordData.tokens.access_token,
                discord_refresh: discordData.tokens.refresh_token,
                discord_expires: discordData.tokens.expires_at                
            }
            // Store the tokens
            // logMessage('Pushing user data to database', { update: !!existingUser, name: user.name });
            if (!user.nexus_access) throw new Error('No Token in new user data!');
            const updatedUser = !!existingUser ? await updateUser(discordData.id, user) : await createUser({ d_id: discordData.id, ...user } as NexusUser);
            await this.updateDiscordMetadata(discordData.id, updatedUser);
            logMessage('OAuth Account link success', { discord: discordData.name, nexusMods: user.name });
            const params: Record<string, string> =  {
                nexus: user.name || '',
                n_id: user.id?.toString() || '0',
                discord: discordData.name,
                d_id: discordData.id
            }

            const successUrl = `/success?${new URLSearchParams(params).toString()}`;

            res.redirect(successUrl);

        }
        catch(err) {
            logMessage('Nexus Mods OAuth Error', err, true);
            res.cookie('ErrorDetail', `Neuxs Mods OAuth Error: ${(err as Error).message || err}`, { maxAge: 1000 * 60 * 2, signed: true });
            res.redirect('/oauth-error');
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
            res.statusCode = 500;
            res.send(`Error in update-meta request: ${(err as Error)?.message}`);
        }
    }

    async showMetaData(req: express.Request, res: express.Response) {
        try {
            const id = req.query['id'];
            if (!id) throw new Error('ID not sent');
            const user = await getUserByDiscordId(id as string);
            const meta = user ? await user.Discord.GetRemoteMetaData() : {};
            res.send(JSON.stringify(meta, null, '</br>'));
            
        }
        catch(err) {
            res.cookie('ErrorDetail', `Error getting metadata: ${(err as Error).message}`, { maxAge: 1000 * 60 * 2, signed: true });
            res.redirect('/oauth-error');
        }
        
    }

    async updateDiscordMetadata(userId: string, user?: DiscordBotUser | undefined) {
        let metadata = {};
        if (!user) user = await getUserByDiscordId(userId);
        if (!user) throw new Error('No linked users for this Discord ID.');
        try {
            await user.NexusMods.Auth();
            await user.NexusMods.Refresh();
            metadata = await user.Discord.BuildMetaData();
        }
        catch(err) {
            logMessage(`Error updating role metadata: [[${(err as Error).message}]]`, err, true);
        }

        await user.Discord.PushMetaData(metadata);

    }

    async revokeAccess(req: express.Request, res: express.Response) {
        try {
            const id: string = req.query['id'] as string;
            if (!id) throw new Error('Discord ID parameter was not supplied.');
            const user = await getUserByDiscordId(id);
            if (!user) throw new Error(`No links exist for the Discord ID ${id}`);
            // Revoke Discord tokens
            await user.Discord.Revoke();

            // Revoke Nexus Mods tokens
            await user.NexusMods.Revoke();

            // Delete from database
            await deleteUser(id);

            logMessage('Revoke successful for user', user.NexusModsUsername);
            res.statusCode = 200;
            res.render('revoked', { pageTitle: 'Link Removed' });
        }
        catch(err) {
            logMessage('Error removing account link', err, true);
            res.cookie('ErrorDetail', `Error unlinking accounts: ${(err as Error).message}`, { maxAge: 1000 * 60 * 2, signed: true });
            res.redirect('/unlink-error');
        }
        
    }

    async beaconTest(req: express.Request, res: express.Response) {
        res.render('beacon', { pageTitle: 'Beacon Test Page', loadBeacon: true });
    }

    async tracking(req: express.Request, res: express.Response) {
        const guild = req.query['guild'] as string;
        const channel = req.query['channel'] as string;
        if (!guild || !channel) return res.redirect('/')
        const knownGuild = await this.client.guilds.fetch(guild);
        if (!knownGuild) return res.redirect('/');
        const guildImage = knownGuild.iconURL();
        const knownChannel = await knownGuild.channels.fetch(channel);
        if (!knownChannel) return res.redirect('/');
        const subs = (await getSubscriptionsByChannel(guild, channel)).sort((a,b) => b.last_update.getTime() - a.last_update.getTime());

        const timeAgo = (timestamp: string) => {
            const now = new Date();
            const diff = now.getTime() - new Date(timestamp).getTime();
            const seconds = Math.floor(diff / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);
        
            if (seconds < 60) return `${seconds} seconds ago`;
            if (minutes < 60) return `${minutes} minutes ago`;
            if (hours < 24) return `${hours} hours ago`;
            return `${days} days ago`;
        }

        res.render('tracking', { pageTitle: 'Tracking Summary', guild: knownGuild.name, channel: knownChannel.name, guildImage, subs, timeAgo });
    }


    async nxmForward(req: express.Request, res: express.Response) {
        const type = req.query['type'] as string;
        if (type === 'collection') {
            const domain = req.query['domain'] as string;
            const slug = req.query['slug'] as string;
            const rev = req.query['rev'] as string;
            if (!domain || !slug) {
                res.statusCode = 400
                res.send('Domain or slug not provided')
                return;
            }
            const nxmlink = `nxm://${domain}/collections/${slug}/revisions/${rev ?? 'latest'}`;
            res.redirect(nxmlink);
            return;
        }
        else if (type === 'mod') {
            const domain = req.query['domain'] as string;
            const modId = req.query['mod_id'] as string;
            const fileId = req.query['file_id'] as string;
            if (!domain || !modId || fileId) {
                res.statusCode = 400
                res.send('Game, mod or file ID not provided')
                return;
            }
            const nxmlink = `nxm://${domain}/mods/${modId}/revisions/${fileId}`;
            res.redirect(nxmlink);
            return;
        }        
    }
}