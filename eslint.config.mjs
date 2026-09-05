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
            "**/dist/**",
            "**/.next/**",
            // Generated from schema.graphql by `npm run codegen`. Lint rules are for
            // code someone writes; editing this to satisfy them would be undone by the
            // next generation.
            "**/src/generated/**",
            "node_modules/**",
            "*.cjs",
            "eslint.config.mjs",
        ],
    },
    js.configs.recommended,
    {
        // Build tooling. Not covered by tsconfig.json, so no type-aware rules here.
        files: ["**/scripts/**/*.mjs", "**/*.config.mjs", "**/*.config.ts"],
        languageOptions: {
            parser: tsParser,
            globals: { ...globals.node },
        },
    },
    {
        // apps/web keeps its routes in app/ rather than src/, which is Next's layout and
        // not worth fighting. Without the third pattern eslint reports "File ignored
        // because no matching configuration was supplied" - as a warning, while still
        // exiting 0, so `npm run lint` passes and lints nothing.
        files: ["apps/*/src/**/*.ts", "apps/*/tests/**/*.ts", "apps/*/app/**/*.{ts,tsx}"],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 2022,
                sourceType: "module",
                // .tsx needs this; the parser does not infer JSX from the extension.
                ecmaFeatures: { jsx: true },
                // Type-aware linting. Required by no-floating-promises and
                // no-misused-promises, which are the rules that earn their keep here.
                //
                // projectService rather than a `project` path: one config at the root now
                // lints several workspaces, and it resolves the nearest tsconfig for each
                // file itself. A hard-coded "./tsconfig.json" pointed at the repository
                // root, which after the 5.0.0 move holds no tsconfig at all - and a
                // second workspace would have needed a second entry here.
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
            globals: {
                ...globals.node,
                // The web app renders in a browser as well as on the server; without
                // these, no-undef fires on document, window and friends.
                ...globals.browser,
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
            // Both were at "warn" through 4.0.0's Phase 1 with 38 outstanding findings.
            // Phase 2 cleared them, so they are errors now and CI will not let another in.
            // An unhandled rejection here is a crashed shard, not a style nit.
            "@typescript-eslint/no-floating-promises": "error",
            // async callbacks passed where a void return is expected.
            "@typescript-eslint/no-misused-promises": "error",
            // find(c => c.channel_id === c.channel_id)
            "no-self-compare": "error",
            // if (a) {} else { if (b) {} }
            "no-unreachable-loop": "error",
            // Catches `if (x = 1)` and similar.
            "no-cond-assign": ["error", "always"],
            "no-constant-binary-expression": "error",
            "require-atomic-updates": "warn",

            // Type-only imports are erased by the compiler, so an edge that exists
            // only to carry a type cannot cause a cycle at runtime. Marking them
            // explicitly is what turns most of this codebase's import cycles from
            // real into imaginary. `inline-type-imports` keeps mixed imports on one
            // line rather than splitting them into two statements.
            "@typescript-eslint/consistent-type-imports": ["error", {
                prefer: "type-imports",
                fixStyle: "separate-type-imports",
                disallowTypeAnnotations: false,
            }],

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
