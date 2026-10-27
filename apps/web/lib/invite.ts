/**
 * The "add the bot to a server" URL, in one place.
 *
 * Discord's own install flow: the user picks the server and approves the scopes, so this
 * is a link rather than anything the site does on their behalf.
 */
export function botInviteUrl(clientId = process.env.DISCORD_CLIENT_ID ?? ''): string {
    const url = new URL('https://discord.com/api/oauth2/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('scope', 'applications.commands bot');
    return url.toString();
}
