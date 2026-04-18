import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactPlugin from 'eslint-plugin-react';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default tseslint.config(
  // Base JS recommended rules
  js.configs.recommended,

  // TypeScript rules
  ...tseslint.configs.recommended,

  // React Hooks rules
  {
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },

  // eslint-plugin-react — only the rules we need
  {
    plugins: {
      react: reactPlugin,
    },
    settings: {
      react: { version: 'detect' },
    },
  },

  // Accessibility rules (jsx-a11y) — all set to warn so we can migrate incrementally.
  // Do not promote to error until Phase 7 a11y hardening pass.
  {
    plugins: {
      'jsx-a11y': jsxA11y,
    },
    rules: Object.fromEntries(
      Object.entries(jsxA11y.configs.recommended.rules ?? {}).map(([rule, severity]) => [
        rule,
        severity === 'error' ? 'warn' : severity,
      ])
    ),
  },

  // Project-specific overrides
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      // Inline styles are flagged as warnings — migrate incrementally (Phase 5.1)
      'react/forbid-dom-props': ['warn', { forbid: ['style'] }],

      // TypeScript: allow explicit `any` in legacy code — tighten in Phase 6
      '@typescript-eslint/no-explicit-any': 'warn',

      // Unused vars: prefix with _ to suppress (tightened in Phase 6.1)
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      // Allow empty catch blocks in legacy code
      'no-empty': ['warn', { allowEmptyCatch: true }],

      // Allow non-null assertions — legacy usage; Phase 6 to tighten
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // Pre-existing: require() imports exist in legacy config files — Phase 6 to convert
      '@typescript-eslint/no-require-imports': 'warn',

      // React Hooks core rules
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'warn',

      // React Compiler rules (react-hooks v7+) — downgraded to warn on baseline
      // These flag real issues to address incrementally; not blockers for the safety-net
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/no-deriving-state-in-effects': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/use-memo': 'warn',
      'react-hooks/void-use-memo': 'warn',
      'react-hooks/invariant': 'warn',

      // Base JS rules — pre-existing issues, downgraded to warn
      'no-useless-assignment': 'warn',
      'no-constant-binary-expression': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      'prefer-const': 'warn',
    },
  },

  // Ignore build output and config files
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      '*.config.js',
      '*.config.ts',
      'vite.config.ts',
      'vitest.config.ts',
      'playwright.config.ts',
    ],
  },
);
