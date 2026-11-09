// The rules Obsidian's community review applies (eslint-plugin-obsidianmd, recommended), over the plugin, its tests, the
// repository's scripts and the agent skill's scripts (command-line tools for Node, which Obsidian never loads and the
// plugin doesn't bundle).
import { defineConfig } from 'eslint/config';
import obsidianmd from 'eslint-plugin-obsidianmd';

export default defineConfig([
  {
    ignores: [
      'main.js',
      'styles.css',
      'build/**',
      'dist/**',
      'node_modules/**',
      '*.config.mjs',
      '*.config.ts',
      'stubs/**',
    ],
  },
  ...obsidianmd.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['eslint.config.mjs', 'scripts/*.mjs', 'skills/*/scripts/*.mjs'] },
      },
    },
  },
  {
    // The scripts run in Node, never in Obsidian. The recommended config gives Node's globals only to the code of a
    // desktop-only plugin, and Excaliboard also runs on phones.
    files: ['scripts/*.mjs', 'skills/*/scripts/*.mjs'],
    languageOptions: { globals: { process: 'readonly', Buffer: 'readonly' } },
  },
]);
