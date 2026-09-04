import { describe, it, expect, vi } from 'vitest';
import type { Logger } from '../../src/api/logger.js';
import { trimCollectionChangelog, trimModChangelog } from '../../src/feeds/subscriptionEmbeds.js';

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as Logger;

describe('trimCollectionChangelog', () => {
    it('strips images, which cannot render inside an embed field', () => {
        const out = trimCollectionChangelog('Before ![alt text](https://example.com/a.png) after');
        expect(out).not.toContain('https://example.com/a.png');
        expect(out).toContain('Before');
        expect(out).toContain('after');
    });

    it('demotes h1 and h2 to h3, since Discord renders h1 very large', () => {
        expect(trimCollectionChangelog('# Title')).toContain('### Title');
        expect(trimCollectionChangelog('## Subtitle')).toContain('### Subtitle');
    });

    it('leaves an existing h3 alone', () => {
        expect(trimCollectionChangelog('### Already')).toContain('### Already');
    });

    it('collapses a details block to its summary', () => {
        const out = trimCollectionChangelog('<details><summary>Full list</summary>lots of hidden text</details>');
        expect(out).toContain('Full list');
        expect(out).not.toContain('lots of hidden text');
    });

    it('stays within the requested length', () => {
        const long = Array.from({ length: 200 }, (_, i) => `line ${i} with some padding text`).join('\n');
        expect(trimCollectionChangelog(long, 500).length).toBeLessThanOrEqual(500);
    });

    it('returns something usable for empty input', () => {
        expect(typeof trimCollectionChangelog('')).toBe('string');
    });
});

describe('trimModChangelog', () => {
    it('joins lines up to the limit and marks the truncation', () => {
        const out = trimModChangelog(Array.from({ length: 100 }, (_, i) => `change number ${i}`), 200, logger);
        expect(out.length).toBeLessThanOrEqual(203);
        expect(out.endsWith('...')).toBe(true);
    });

    it('returns everything when it fits, with no ellipsis', () => {
        const out = trimModChangelog(['one', 'two'], 1000, logger);
        expect(out).toBe('one\ntwo');
        expect(out).not.toContain('...');
    });

    it('detects the broken API payload and explains it instead of printing it', () => {
        // The v2 API returns a Ruby object inspection string here rather than a
        // changelog; users should get an explanation, not "#<ModChangelog...".
        const out = trimModChangelog(['#<ModChangelog id: 1, mod_id: 2>'], 1000, logger);
        expect(out).not.toContain('#<ModChangelog');
        expect(out).toContain('API bug');
    });
});
