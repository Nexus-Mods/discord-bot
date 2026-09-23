import { describe, it, expect } from 'vitest';
import type { IModFile } from '@nexusmods/nexus-api/queries/v2.js';
import type { IModWithFiles, SubscribedItem, SubscribedItemType } from '@nexusmods/persistence/types/subscriptions.js';
import { changelogChanged, markUpdatesPosted, modUpdateAllowed } from '../../src/feeds/updateFilters.js';


const HOUR_S = 60 * 60;

function file(partial: Partial<IModFile>): IModFile {
    return {
        uid: '0',
        uri: '',
        fileId: 0,
        name: 'file',
        version: '1.0',
        category: 'main',
        changelogText: [],
        date: 0,
        description: '',
        manager: 1,
        scannedV2: true,
        ...partial,
    } as IModFile;
}

function mod(uid: string, files: IModFile[]): IModWithFiles {
    return { uid, files } as IModWithFiles;
}

function sub(config: Record<string, unknown>, last_update = new Date(1_000_000_000_000)): SubscribedItem<SubscribedItemType.Game> {
    return { config, last_update } as unknown as SubscribedItem<SubscribedItemType.Game>;
}

describe('changelogChanged', () => {
    const since = new Date(1_000 * 1000); // files dated above 1000s are "new"

    it('is true when a new file has a changelog the previous file did not', () => {
        const m = mod('a', [
            file({ date: 2000, changelogText: ['fixed things'] }),
            file({ date: 1000, changelogText: ['old notes'] }),
        ]);
        expect(changelogChanged(m, since)).toBe(true);
    });

    it('is false when the new file repeats the previous changelog', () => {
        const m = mod('a', [
            file({ date: 2000, changelogText: ['same notes'] }),
            file({ date: 1000, changelogText: ['same notes'] }),
        ]);
        expect(changelogChanged(m, since)).toBe(false);
    });

    it('is false when the new file has no changelog', () => {
        const m = mod('a', [
            file({ date: 2000, changelogText: [] }),
            file({ date: 1000, changelogText: ['old notes'] }),
        ]);
        expect(changelogChanged(m, since)).toBe(false);
    });

    it('is false when nothing was uploaded since the last check', () => {
        const m = mod('a', [file({ date: 500, changelogText: ['old notes'] })]);
        expect(changelogChanged(m, since)).toBe(false);
    });

    it('checks each new file against the one before it', () => {
        const m = mod('a', [
            file({ date: 3000, changelogText: [] }),            // newest, no changelog
            file({ date: 2000, changelogText: ['new notes'] }),   // changed vs the old file
            file({ date: 500, changelogText: ['old notes'] }),
        ]);
        expect(changelogChanged(m, since)).toBe(true);
    });
});

describe('modUpdateAllowed', () => {
    const since = new Date(1_000 * 1000);
    const changed = mod('a', [
        file({ date: 2000, changelogText: ['new notes'] }),
        file({ date: 500, changelogText: ['old notes'] }),
    ]);
    const unchanged = mod('b', [
        file({ date: 2000, changelogText: ['same notes'] }),
        file({ date: 500, changelogText: ['same notes'] }),
    ]);

    it('allows everything with no filters set', () => {
        const item = sub({ show_updates: true });
        expect(modUpdateAllowed(unchanged, item)).toBe(true);
    });

    it('with changelog_only, only changed changelogs get through', () => {
        const item = sub({ changelog_only: true }, since);
        expect(modUpdateAllowed(changed, item)).toBe(true);
        expect(modUpdateAllowed(unchanged, item)).toBe(false);
    });

    it('with a cooldown, a recently posted mod is suppressed', () => {
        const now = Date.now();
        const item = sub({
            update_cooldown_hours: 4,
            last_posted: { b: new Date(now - HOUR_S * 1000).toISOString() },
        }, since);
        expect(modUpdateAllowed(unchanged, item, now)).toBe(false);
    });

    it('with a cooldown, a mod not posted recently gets through', () => {
        const now = Date.now();
        const item = sub({ update_cooldown_hours: 4 }, since);
        expect(modUpdateAllowed(unchanged, item, now)).toBe(true);
        item.config.last_posted = { b: new Date(now - 5 * HOUR_S * 1000).toISOString() };
        expect(modUpdateAllowed(unchanged, item, now)).toBe(true);
    });

    it('with both, a changed changelog still posts inside the cooldown', () => {
        const now = Date.now();
        const item = sub({
            changelog_only: true,
            update_cooldown_hours: 4,
            last_posted: { a: new Date(now - HOUR_S * 1000).toISOString(), b: new Date(now - HOUR_S * 1000).toISOString() },
        }, since);
        expect(modUpdateAllowed(changed, item, now)).toBe(true);
        expect(modUpdateAllowed(unchanged, item, now)).toBe(false);
    });
});

describe('markUpdatesPosted', () => {
    it('records the post time per mod and keeps it on the sub config', () => {
        const now = new Date();
        const item = sub({ update_cooldown_hours: 4 });
        const posted = markUpdatesPosted(item, [mod('a', []), mod('b', [])], now);
        expect(posted.a).toBe(now.toISOString());
        expect(posted.b).toBe(now.toISOString());
        expect(item.config.last_posted).toEqual(posted);
    });

    it('drops entries older than the cooldown window', () => {
        const now = new Date();
        const stale = new Date(now.getTime() - 10 * HOUR_S * 1000).toISOString();
        const item = sub({ update_cooldown_hours: 4, last_posted: { old: stale } });
        const posted = markUpdatesPosted(item, [mod('a', [])], now);
        expect(posted.old).toBeUndefined();
        expect(posted.a).toBe(now.toISOString());
    });
});
