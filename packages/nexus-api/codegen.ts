import type { CodegenConfig } from '@graphql-codegen/cli';

/**
 * Types for the Nexus Mods v2 GraphQL API, generated from the schema.
 *
 * Every result shape used to be hand-written, which made the types a guess the compiler
 * could not check - and several of them were wrong. These are generated from
 * `schema.graphql` and the operations in `src/queries`, so they cannot drift from
 * what the API actually returns.
 *
 * The schema is committed rather than introspected at build time. Introspection is
 * enabled on the endpoint today, but a build that depends on a remote endpoint breaks
 * when that changes, and a committed schema turns an API change into a reviewable diff.
 * Refresh it by re-running the introspection query and rebuilding the SDL.
 *
 * Two files, not one: `typescript-operations` re-emits the input types an operation
 * references, so combining both plugins into a single output produces duplicate
 * identifiers and the file will not compile. The import-types preset points the
 * operations file at the types file instead.
 */
const shared = {
    enumsAsTypes: true,
    skipTypename: true,
    // Nullable fields become `T | null` rather than optional properties, so a field the
    // API can return null for cannot be silently read as present.
    avoidOptionals: { field: true },
    scalars: { ID: 'string', DateTime: 'string', BigInt: 'string', JSON: 'unknown' },
};

const config: CodegenConfig = {
    schema: './schema.graphql',
    documents: ['src/queries/**/*.ts'],
    ignoreNoDocuments: false,
    generates: {
        './src/generated/types.ts': {
            plugins: ['typescript'],
            config: shared,
        },
        './src/generated/operations.ts': {
            preset: 'import-types',
            presetConfig: { typesPath: './types.js' },
            plugins: ['typescript-operations'],
            config: shared,
        },
    },
};

export default config;
