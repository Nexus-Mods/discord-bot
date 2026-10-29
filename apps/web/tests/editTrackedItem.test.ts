import { describe, it, expect } from 'vitest';
import { SubscribedItemType } from '@nexusmods/persistence/types/subscriptions.js';
import { settingsFrom, changedFields, writableKeys, MAX_MESSAGE_LENGTH } from '@/lib/manage/editTrackedItem';

/**
 * What a submitted form is allowed to do to a row.
 *
 * The config blob is shared between the portal and the bot, and most of what can go wrong
 * here goes wrong quietly: a key the form never rendered disappearing, an unchecked box
 * read as "no opinion" rather than "no", a save moving the feed's watermark. None of those
 * raise an error - the feed simply stops posting what it used to.
 */

const submitted = (over: Partial<Parameters<typeof settingsFrom>[2]> = {}) => ({
    crosspost: false,
    compact: false,
    message: '',
    config: {},
    ...over,
});

const assemble = (existing: Record<string, unknown>, over = {}) => {
    const result = settingsFrom(SubscribedItemType.Game, existing, submitted(over));
    if (!result.ok) throw new Error(`expected a save, got: ${result.error}`);
    return result.settings;
};

describe('what survives a save', () => {
    it('keeps a key the bot owns and the form never showed', () => {
        // last_status is how a mod feed knows what changed. The form has no control for
        // it, so a config rebuilt from the form alone would silently drop it.
        const settings = assemble({ last_status: 'published', show_new: true });
        expect(settings.config.last_status).toBe('published');
    });

    it('keeps a key nothing declares', () => {
        // Someone set it by hand, or it predates the table. Dropping it on an unrelated
        // save would be a change nobody asked for and nobody would see.
        const settings = assemble({ mystery_option: 'on' });
        expect(settings.config.mystery_option).toBe('on');
    });

    it('never offers a read-only key to the form', () => {
        expect(writableKeys(SubscribedItemType.Mod).map((s) => s.key)).not.toContain('last_status');
    });
});

describe('what an absent checkbox means', () => {
    it('stores false rather than leaving the key absent', () => {
        // A browser sends nothing for an unchecked box. sfw defaults to true, so an absent
        // key would read as "include safe mods" - the opposite of what was just unticked.
        const settings = assemble({ sfw: true }, { config: {} });
        expect(settings.config.sfw).toBe(false);
    });

    it('stores true for a ticked box', () => {
        const settings = assemble({}, { config: { show_new: 'on' } });
        expect(settings.config.show_new).toBe(true);
    });
});

describe('the three-way keys', () => {
    it('removes the key for "inherit" rather than storing false', () => {
        // showAdult() reads `config.nsfw ?? channel.nsfw`. A stored false is a decision to
        // exclude adult mods even in an age-restricted channel; an absent key follows it.
        const settings = assemble({ nsfw: true }, { config: { nsfw: 'inherit' } });
        expect(Object.prototype.hasOwnProperty.call(settings.config, 'nsfw')).toBe(false);
    });

    it('stores a real no', () => {
        // sfw ticked as well: excluding adult mods while also excluding safe ones is the
        // combination the guard below rejects, and it is easy to write by accident.
        const settings = assemble({}, { config: { nsfw: 'no', sfw: 'on' } });
        expect(settings.config.nsfw).toBe(false);
    });

    it('stores a real yes', () => {
        const settings = assemble({}, { config: { nsfw: 'yes' } });
        expect(settings.config.nsfw).toBe(true);
    });
});

describe('what the form refuses', () => {
    it('refuses a feed that would post nothing', () => {
        // The same guard /track applies when creating one. Both off is not a filter, it is
        // a feed that silently never posts again.
        const result = settingsFrom(SubscribedItemType.Game, {}, submitted({ config: { nsfw: 'no' } }));
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toContain('nothing');
    });

    it('refuses a message Discord would reject', () => {
        const result = settingsFrom(SubscribedItemType.Game, {}, submitted({
            config: { sfw: 'on' }, message: 'x'.repeat(MAX_MESSAGE_LENGTH + 1),
        }));
        expect(result.ok).toBe(false);
    });

    it('accepts a message at the limit', () => {
        const settings = assemble({}, { config: { sfw: 'on' }, message: 'x'.repeat(MAX_MESSAGE_LENGTH) });
        expect(settings.message).toHaveLength(MAX_MESSAGE_LENGTH);
    });
});

describe('the message field', () => {
    it('stores an emptied box as null, not an empty string', () => {
        const settings = assemble({ sfw: true }, { config: { sfw: 'on' }, message: '   ' });
        expect(settings.message).toBeNull();
    });
});

describe('changedFields', () => {
    const before = { crosspost: false, compact: true, message: null, config: { show_new: true } };

    it('says nothing changed when nothing did', () => {
        expect(changedFields(before, {
            crosspost: false, compact: true, message: null, config: { show_new: true },
        })).toEqual([]);
    });

    it('notices a key appearing and a key leaving', () => {
        const changed = changedFields(before, {
            crosspost: false, compact: true, message: null, config: { nsfw: false },
        });
        expect(changed).toContain('config.nsfw');
        expect(changed).toContain('config.show_new');
    });

    it('notices a column', () => {
        expect(changedFields(before, {
            crosspost: true, compact: true, message: null, config: { show_new: true },
        })).toEqual(['crosspost']);
    });
});
