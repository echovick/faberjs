import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  // Ignored paths
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/*.js',
      '**/*.mjs',
      '**/*.cjs',
      'pnpm-lock.yaml',
    ],
  },

  // JS recommended base
  js.configs.recommended,

  // TypeScript strict rules (no type-aware rules for monorepo speed)
  ...tseslint.configs.recommended,
  ...tseslint.configs.stylistic,

  // FaberJS project rules
  {
    rules: {
      // TypeScript strictness
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'off', // covered by no-explicit-any
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
          allowDirectConstAssertionInArrowFunctions: true,
        },
      ],
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
      // prefer-nullish-coalescing and prefer-optional-chain require type-aware
      // parsing; enable them by adding parserOptions.project if needed later.
      '@typescript-eslint/no-non-null-assertion': 'warn',
      // Allow empty bodies on override methods (service provider lifecycle hooks,
      // test stubs, etc.) — these are intentionally no-ops.
      '@typescript-eslint/no-empty-function': ['error', { allow: ['overrideMethods'] }],

      // General quality
      'no-console': 'warn',
      'no-debugger': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },

  // Prettier must be last — disables all formatting rules
  prettierConfig,
);
