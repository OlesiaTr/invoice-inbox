import type { CodegenConfig } from '@graphql-codegen/cli';

// Typed GraphQL documents generated from the backend's code-first schema.
// Operations live as .gql files under graphql/, one per file, grouped by operation type
// and then by domain — so the wire contract is readable without opening any React code.
// documentMode "string": documents are plain strings at runtime — no GraphQL parser in the bundle.
const config: CodegenConfig = {
  schema: '../backend/schema.graphql',
  documents: ['graphql/**/*.gql'],
  ignoreNoDocuments: true,
  generates: {
    './src/gql/': {
      preset: 'client',
      config: {
        documentMode: 'string',
        enumsAsTypes: true,
        useTypeImports: true,
        scalars: { DateTime: 'string' },
      },
      presetConfig: { fragmentMasking: false },
    },
  },
};

export default config;
