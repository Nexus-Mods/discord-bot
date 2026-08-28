import js from "@eslint/js";
import globals from "globals";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

// This is a flat config (ESLint 9). The previous version was a half-finished
// migration from .eslintrc: it used `extends: ["plugin:@typescript-eslint/..."]`
// and `plugins: ["@typescript-eslint"]`, neither of which flat config accepts,
// so every lint run failed with "Plugin not found" and nothing was ever checked.
//
// Formatting rules (indent, quotes, semi, comma-dangle and friends) are
// deliberately absent. They were configured for tabs and single quotes while the
// codebase uses four spaces and mixed quotes, so they produced thousands of
// findings and drowned out real ones. Formatting belongs to a formatter -
// see MODERNISATION.md Phase 1.

export default [
    {
        ignores: [
            "dist/**",
            "node_modules/**",
            "*.cjs",
            "eslint.config.mjs",
        ],
    },
    js.configs.recommended,
    {
        // Build tooling. Not covered by tsconfig.json, so no type-aware rules here.
        files: ["scripts/**/*.mjs", "*.config.mjs", "*.config.ts"],
        languageOptions: {
            parser: tsParser,
            globals: { ...globals.node },
        },
    },
    {
        files: ["src/**/*.ts", "tests/**/*.ts"],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 2022,
                sourceType: "module",
                // Type-aware linting. Required by no-floating-promises and
                // no-misused-promises, which are the rules that earn their keep here.
                project: "./tsconfig.json",
                tsconfigRootDir: import.meta.dirname,
            },
            globals: {
                ...globals.node,
            },
        },
        plugins: {
            "@typescript-eslint": tsPlugin,
        },
        rules: {
            ...tsPlugin.configs["eslint-recommended"].overrides[0].rules,
            ...tsPlugin.configs["recommended"].rules,

            // --- The rules that catch the bug families found in the Phase 0 audit ---
            // Un-awaited promises: AutoModManager.clearRuleCache, the startup
            // setTimeout in SubscriptionManager, setEventHandler in DiscordBot.
            // 44 existing findings as of the Phase 0 audit. Kept at "warn" so lint can
            // gate CI on errors today; Phase 2 works the count down to zero and these
            // become errors. Run `npm run lint:strict` to see them as errors.
            "@typescript-eslint/no-floating-promises": "warn",
            // async callbacks passed where a void return is expected.
            "@typescript-eslint/no-misused-promises": "warn",
            // find(c => c.channel_id === c.channel_id)
            "no-self-compare": "error",
            // if (a) {} else { if (b) {} }
            "no-unreachable-loop": "error",
            // Catches `if (x = 1)` and similar.
            "no-cond-assign": ["error", "always"],
            "no-constant-binary-expression": "error",
            "require-atomic-updates": "warn",

            // --- Hygiene ---
            "no-var": "error",
            "prefer-const": "error",
            "eqeqeq": ["warn", "smart"],
            "no-console": "warn",
            "no-empty-function": "off",
            "@typescript-eslint/no-empty-function": "warn",
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": ["warn", {
                argsIgnorePattern: "^_",
                varsIgnorePattern: "^_",
                caughtErrorsIgnorePattern: "^_",
            }],

            // --- Turned down: these fire widely on existing code and are Phase 2/3 work ---
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-non-null-assertion": "off",
            "@typescript-eslint/explicit-function-return-type": "off",
        },
    },
];
