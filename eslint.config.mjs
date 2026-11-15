import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import importX from 'eslint-plugin-import-x';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Limits come from the coding standards in CLAUDE.md.
const MAX_COMPLEXITY = 10;
const MAX_DEPTH = 3;
const MAX_PARAMS = 4;
const MAX_FUNCTION_LINES = 60;
const MAX_COMPONENT_LINES = 120;
const MAX_FILE_LINES = 300;

const envMessage = 'Read configuration through the typed config service.';

const sizeLimitedFiles = ['**/*.ts', '**/*.tsx'];
const exemptFromLimits = [
  '**/*.spec.ts',
  '**/*.spec.tsx',
  '**/*.int-spec.ts',
  '**/test/**',
  '**/prisma/seed/**',
  '**/prisma/seed.ts',
];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      'planning/**',
      '**/prisma/migrations/**',
      '**/generated/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.mjs', '**/*.cjs', '**/*.js'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ...tseslint.configs.disableTypeChecked.languageOptions,
      globals: globals.node,
    },
  },
  {
    plugins: { 'import-x': importX },
    settings: {
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          alwaysTryTypes: true,
          // Each app's own tsconfig, so the admin's `@/` alias resolves.
          project: ['apps/*/tsconfig.json', 'packages/*/tsconfig.json'],
          noWarnOnMultipleProjects: true,
        }),
      ],
    },
    rules: {
      'import-x/no-cycle': 'error',
      'import-x/no-duplicates': 'error',
      'import-x/no-self-import': 'error',
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
    },
  },
  {
    files: sizeLimitedFiles,
    rules: {
      eqeqeq: ['error', 'always'],
      'no-console': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'no-nested-ternary': 'error',
      'no-empty': ['error', { allowEmptyCatch: false }],
      complexity: ['error', MAX_COMPLEXITY],
      'max-depth': ['error', MAX_DEPTH],
      'max-params': 'off',
      '@typescript-eslint/max-params': ['error', { max: MAX_PARAMS }],
      'max-lines': ['error', { max: MAX_FILE_LINES, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': [
        'error',
        { max: MAX_FUNCTION_LINES, skipBlankLines: true, skipComments: true },
      ],
      'no-magic-numbers': 'off',
      '@typescript-eslint/no-magic-numbers': [
        'error',
        {
          ignore: [-1, 0, 1],
          ignoreArrayIndexes: true,
          ignoreDefaultValues: true,
          ignoreEnums: true,
          ignoreNumericLiteralTypes: true,
          ignoreReadonlyClassProperties: true,
          ignoreTypeIndexes: true,
          enforceConst: true,
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[property.name='env'][object.name='process']",
          message: envMessage,
        },
        {
          selector: "MemberExpression[property.name='env'][object.property.name='process']",
          message: envMessage,
        },
        {
          selector:
            "VariableDeclarator[init.name='process'] > ObjectPattern > Property[key.name='env']",
          message: envMessage,
        },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      // Nest modules are empty classes configured through decorators.
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': true, 'ts-ignore': true },
      ],
      'import-x/no-default-export': 'error',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'process', importNames: ['env'], message: envMessage },
            { name: 'node:process', importNames: ['env'], message: envMessage },
          ],
        },
      ],
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: 'enumMember', format: ['UPPER_CASE'] },
        {
          selector: 'variable',
          modifiers: ['const'],
          format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
        },
      ],
    },
  },
  {
    // Hooks live in .ts files too; the hook rules must check them as well as components.
    files: ['**/use-*.ts'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['**/*.tsx'],
    plugins: {
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    settings: { react: { version: 'detect' } },
    languageOptions: { globals: globals.browser },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      'react/no-danger': 'error',
      'react/prop-types': 'off',
      'max-lines-per-function': [
        'error',
        { max: MAX_COMPONENT_LINES, skipBlankLines: true, skipComments: true },
      ],
    },
  },
  {
    files: exemptFromLimits,
    rules: {
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': 'allow-with-description', 'ts-ignore': true },
      ],
      '@typescript-eslint/no-magic-numbers': 'off',
      '@typescript-eslint/max-params': 'off',
      'max-depth': 'off',
      // Test clients such as supertest return untyped response bodies.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      complexity: 'off',
    },
  },
  {
    // Only the config module (and the test env setup that feeds it) may touch process.env.
    files: [
      '**/src/config/**',
      '**/test/helpers/integration-setup.ts',
      '**/test/helpers/global-setup.ts',
      '**/*.config.ts',
      '**/prisma.config.ts',
      // Browser tests start the whole stack and hand it its environment.
      'apps/e2e/test/e2e-env.ts',
      'apps/e2e/test/prepare-database.ts',
    ],
    rules: { 'no-restricted-syntax': 'off', 'no-restricted-imports': 'off' },
  },
  {
    // Frameworks that load these files expect a default export.
    files: [
      '**/*.config.ts',
      '**/*.config.mts',
      '**/vite.config.*',
      '**/src/pages/**/index.tsx',
      '**/test/helpers/global-setup.ts',
    ],
    rules: { 'import-x/no-default-export': 'off' },
  },
  prettier,
);
