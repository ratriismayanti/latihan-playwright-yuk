// eslint.config.mjs
import tseslint from 'typescript-eslint';
import playwright from 'eslint-plugin-playwright'; // aturan khusus test Playwright

export default tseslint.config( // konfigurasi ESLint
  ...tseslint.configs.recommended,
  {
    files: ['tests/**/*.ts'],
    ...playwright.configs['flat/recommended'],
    languageOptions: { parserOptions: { projectService: true } },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error', // menangkap await yang terlupa!
      'playwright/no-focused-test': 'error',              // melarang test.only
    },
  },
);