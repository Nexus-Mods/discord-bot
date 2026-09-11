import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signValue } from '@nexusmods/auth/signing.js';

/**
 * The signature check standing between a URL and a deleted account link.
 *
 * There is no session on this site, so a correctly signed link for a given Discord id is
 * the entire authorisation - which makes this function the whole access-control story for
 * unlinking, and worth pinning case by case.
 *
 * It also runs on the confirm page now, not only on the submit. Step 6 ported that page
 * reading the two names out of the query string, so it would render any names for any id
 * with no signature involved: the unlink itself was safe, but the page a user reads before
 * deciding could be made to say anything.
 */

const UNLINK_SECRET = 'test-unlink-secret';
const DISCORD_ID = '1234567890';

const getUserByDiscordId = vi.fn();

vi.mock('@nexusmods/account/users.js', () => ({ getUserByDiscordId: (id: string) => getUserByDiscordId(id) }));

const { verifyUnlinkRequest } = await import('@/lib/link/unlink');

const user = { DiscordId: DISCORD_ID, NexusModsUsername: 'Pickysaurus' };
const DAY = 1000 * 60 * 60 * 24;

beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    process.env.UNLINK_SECRET = UNLINK_SECRET;
    getUserByDiscordId.mockResolvedValue(user);
});

describe('verifyUnlinkRequest', () => {
    it('accepts a link the bot signed, and returns the user it names', async () => {
        const token = signValue(DISCORD_ID, DAY, UNLINK_SECRET);
        await expect(verifyUnlinkRequest(DISCORD_ID, token)).resolves.toBe(user);
        expect(getUserByDiscordId).toHaveBeenCalledWith(DISCORD_ID);
    });

    it('refuses a missing id', async () => {
        await expect(verifyUnlinkRequest('', 'anything')).rejects.toThrow('Discord ID parameter was not supplied');
        // Nothing is looked up for a request that cannot name an account.
        expect(getUserByDiscordId).not.toHaveBeenCalled();
    });

    it('FAILS CLOSED with no secret configured', async () => {
        delete process.env.UNLINK_SECRET;
        const token = signValue(DISCORD_ID, DAY, UNLINK_SECRET);
        await expect(verifyUnlinkRequest(DISCORD_ID, token)).rejects.toThrow('Unlinking is not configured');
        expect(getUserByDiscordId).not.toHaveBeenCalled();
    });

    it('refuses a token with no signature, or none at all', async () => {
        for (const token of ['', 'garbage', `${Date.now() + DAY}.`, `${Date.now() + DAY}`]) {
            await expect(verifyUnlinkRequest(DISCORD_ID, token), token).rejects.toThrow('invalid or has expired');
        }
    });

    /**
     * The one the whole scheme is for: a link signed for one account must not work on
     * another. Editing the id in the URL is the obvious attack and it is a one-character
     * edit.
     */
    it('refuses a token signed for a different Discord id', async () => {
        const someoneElse = signValue('9999999999', DAY, UNLINK_SECRET);
        await expect(verifyUnlinkRequest(DISCORD_ID, someoneElse)).rejects.toThrow('invalid or has expired');
    });

    it('refuses a token signed with a different secret', async () => {
        const elsewhere = signValue(DISCORD_ID, DAY, 'another-deployments-secret');
        await expect(verifyUnlinkRequest(DISCORD_ID, elsewhere)).rejects.toThrow('invalid or has expired');
    });

    it('refuses a token past its expiry', async () => {
        const token = signValue(DISCORD_ID, DAY, UNLINK_SECRET);
        // A day and a second later. The expiry is inside the signed material, so this is
        // not something the holder can edit without invalidating it.
        vi.useFakeTimers();
        vi.setSystemTime(Date.now() + DAY + 1000);
        await expect(verifyUnlinkRequest(DISCORD_ID, token)).rejects.toThrow('invalid or has expired');
    });

    it('refuses a valid signature for an account with no link', async () => {
        getUserByDiscordId.mockResolvedValue(undefined);
        const token = signValue(DISCORD_ID, DAY, UNLINK_SECRET);
        await expect(verifyUnlinkRequest(DISCORD_ID, token)).rejects.toThrow('No account link exists');
    });

    it('says something a user can act on', async () => {
        // These messages end up in the error box on the page, so they are part of the
        // interface rather than internal detail.
        await expect(verifyUnlinkRequest(DISCORD_ID, 'garbage')).rejects.toThrow(/Run \/unlink in Discord/);
    });
});
