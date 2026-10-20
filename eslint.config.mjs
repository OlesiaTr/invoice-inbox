import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * One flat config for the whole workspace. Type-aware linting is pointed at each app's
 * tsconfig; generated files (GraphQL codegen, Prisma client, build output) are ignored.
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'apps/web/src/gql/**',
      'apps/web/src/components/ui/**',
      '**/*.config.js',
      'eslint.config.mjs',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Unused args are often there for signature clarity; allow the _ prefix convention
      // the codebase already uses (e.g. `(_a, invoices) => ...` in assistant/tools.ts).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // The codebase deliberately marks fire-and-forget promises with `void`; keep that honest.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': 'warn',

      // An `async` method with no `await` is how you satisfy a Promise-returning abstract
      // contract (MockLlmClient, MemoryStorage) — the keyword is the point, not an oversight.
      '@typescript-eslint/require-await': 'off',
      // Event handlers and test callbacks legitimately pass async functions where a void
      // return is declared; keep the check for everything else.
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false, arguments: false } },
      ],
      // Interpolating a number or a nullish value into a message is intentional throughout.
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowNullish: true, allowBoolean: true, allowAny: true },
      ],
      '@typescript-eslint/no-base-to-string': 'off',
    },
  },

  // Backend: NestJS leans on decorators and parameter properties, and Prisma's raw-query
  // helpers return loosely typed rows that the code narrows by hand.
  {
    files: ['apps/backend/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-extraneous-class': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },

  // Tests: assertions and fakes are intentionally loose.
  {
    files: ['**/*.spec.ts', '**/*.int-spec.ts', '**/*.e2e-spec.ts', '**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // Frontend: the rules that would have caught the stale-dependency bug in InvoicesPage.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      'no-console': 'warn',
    },
  },

  // Must stay last: turns off everything Prettier owns.
  prettier,
);
