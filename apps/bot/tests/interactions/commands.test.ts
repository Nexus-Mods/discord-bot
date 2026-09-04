import { describe, it, expect } from 'vitest';
import type { DiscordInteraction } from '../../src/types/DiscordTypes.js';

/**
 * The bot registers commands by reading dist/interactions at runtime and importing
 * whatever it finds, so a malformed export is only discovered at startup - against
 * the live Discord API. These tests make that a build-time failure instead.
 */

// import.meta.glob is vite's static form of "import everything in this folder"; a
// variable dynamic import cannot be analysed and warns.
const found = import.meta.glob<{ discordInteraction?: DiscordInteraction }>(
    '../../src/interactions/*.ts',
    { eager: true },
);

const modules = Object.entries(found)
    .map(([filePath, module]) => ({ file: filePath.split('/').pop()!, module }))
    .sort((a, b) => a.file.localeCompare(b.file));

const files = modules.map((m) => m.file);

describe('command modules', () => {
    it('finds every command file', () => {
        expect(files.length).toBeGreaterThan(20);
    });

    it.each(modules)('$file exports a usable discordInteraction', ({ module }) => {
        const interaction = module.discordInteraction;
        expect(interaction).toBeDefined();
        expect(typeof interaction!.action).toBe('function');
        expect(interaction!.command).toBeDefined();
    });

    it.each(modules)('$file builds valid command JSON', ({ module }) => {
        // toJSON() is what gets PUT to Discord. It throws on an invalid builder.
        const json = module.discordInteraction!.command.toJSON() as { name: string; type?: number };

        // Discord applies different name rules by command type. Slash commands
        // (type 1, the default) must be lowercase with no spaces; context menu
        // commands (types 2 and 3) take a display label, e.g. "Profile - Nexus Mods".
        const isContextMenu = json.type === 2 || json.type === 3;
        if (isContextMenu) {
            expect(json.name.length).toBeGreaterThan(0);
            expect(json.name.length).toBeLessThanOrEqual(32);
        }
        else {
            expect(json.name).toMatch(/^[-_\p{L}\p{N}]{1,32}$/u);
            expect(json.name).toBe(json.name.toLowerCase());
        }
    });

    it('has no duplicate command names', () => {
        const names = modules.map((m) => (m.module.discordInteraction!.command.toJSON() as { name: string }).name);
        expect(new Set(names).size).toBe(names.length);
    });
});

describe('/track', () => {
    // Pinned because the four subcommand handlers were collapsed into one generic
    // path. The command surface Discord sees must not have moved.
    it('still offers the same subcommands and options', async () => {
        const { discordInteraction } = await import('../../src/interactions/track.js');
        const json = discordInteraction.command.toJSON() as {
            name: string;
            options: { name: string; options?: { name: string }[] }[];
        };

        expect(json.name).toBe('track');
        const shape = Object.fromEntries(json.options.map((o) => [o.name, (o.options ?? []).map((x) => x.name)]));
        expect(shape).toEqual({
            game: ['game', 'message', 'show_new', 'show_updates', 'nsfw', 'sfw', 'compact'],
            mod: ['mod', 'message', 'compact'],
            collection: ['collection', 'message', 'compact'],
            user: ['user', 'message', 'compact'],
        });
    });
});
