import js from '@eslint/js'
import astro from 'eslint-plugin-astro'
import { defineConfig } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  { ignores: ['dist/', '.astro/', '.playwright/'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  astro.configs.recommended,
  astro.configs['jsx-a11y-recommended'],
  {
    files: ['**/*.{js,mjs,ts}'],
    ignores: ['src/scripts/**'],
    languageOptions: { globals: globals.node },
  },
  { files: ['src/scripts/**/*.js'], languageOptions: { globals: globals.browser } },
])
