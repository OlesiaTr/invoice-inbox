import type { CodegenConfig } from '@graphql-codegen/cli';

// Typed GraphQL documents generated from the backend's code-first schema.
// documentMode "string": documents are plain strings at runtime — no GraphQL parser in the bundle.
const config: CodegenConfig = {
  schema: '../backend/schema.graphql',
  documents: ['src/**/*.{ts,tsx}', '!src/gql/**/*'],
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
