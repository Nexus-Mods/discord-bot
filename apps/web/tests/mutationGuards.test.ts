import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The rules that stop a write going wrong, checked against the source rather than through
 * it. In the style of the existing architecture tests, which have caught more here than
 * the unit tests have - and aimed at the failures that produce no error: a save that moves
 * a feed's watermark, or an action that believes what a form told it.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(root, '..', '..');

/** A rule that reads its own documentation as a violation is a bad rule. */
const stripComments = (source: string) => source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

const read = (from: string, file: string) => readFileSync(path.join(from, file), 'utf8');

describe('the tracked item actions', () => {
    const actions = stripComments(read(root, 'app/manage/[guildId]/tracked/[itemId]/actions.ts'));

    it('runs on the server', () => {
        expect(actions).toMatch(/^'use server'/);
    });

    it('reads the session itself rather than taking it from the form', () => {
        expect(actions).toContain('currentSession()');
    });

    it('checks the feed permission itself', () => {
        // The disabled fieldset on the page is a courtesy. This is the guard.
        expect(actions).toContain('guildAccess(');
        expect(actions).toContain('canManageFeeds');
    });

    it('finds the item scoped to the guild', () => {
        // Not a lookup by id alone: ids come from a shared sequence, so an id guessed from
        // another server must not resolve here.
        expect(actions).toContain('findTrackedItem(guildId');
    });

    it('scopes the write to the channel as well as the item', () => {
        expect(actions).toContain('item.parent');
    });

    it('logs who changed what', () => {
        expect(actions).toContain('actor: session.id');
        expect(actions).toContain('changed');
    });

    it('does not log the access token', () => {
        expect(actions).not.toContain('accessToken');
    });
});

describe('saving settings leaves the feed where it was', () => {
    const subscriptions = read(repo, 'packages/persistence/src/subscriptions.ts');

    it('does not touch last_update', () => {
        // The failure this prevents is invisible: CURRENT_DATE is midnight, so a save
        // either skips everything published since the last poll or reposts the day so far.
        const statement = subscriptions
            .slice(subscriptions.indexOf('async function saveSubscriptionSettings'))
            .slice(0, subscriptions.slice(subscriptions.indexOf('async function saveSubscriptionSettings')).indexOf('catch('));
        expect(statement).toContain('UPDATE SubscribedItems');
        expect(statement).not.toContain('last_update');
    });

    it('matches on the parent channel, not just the id', () => {
        expect(subscriptions).toContain('WHERE id=$5 AND parent=$6');
    });

    it('deletes by id and parent together', () => {
        expect(subscriptions).toContain('DELETE FROM SubscribedItems WHERE id=$1 AND parent=$2');
    });
});

describe('the webhook token stays out of the portal', () => {
    it('is never named outside the feed code it belongs to', () => {
        const walk = (dir: string): string[] => {
            const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs');
            return readdirSync(dir).flatMap((entry) => {
                const full = path.join(dir, entry);
                if (statSync(full).isDirectory()) return entry === 'node_modules' || entry === '.next' ? [] : walk(full);
                return /\.tsx?$/.test(full) ? [full] : [];
            });
        };

        const offenders = [...walk(path.join(root, 'app')), ...walk(path.join(root, 'components')), ...walk(path.join(root, 'lib'))]
            .filter((file) => !file.includes(`${path.sep}forum${path.sep}`))
            .filter((file) => /webhook_token/.test(stripComments(readFileSync(file, 'utf8'))));

        expect(offenders.map((f) => path.relative(root, f))).toEqual([]);
    });
});
