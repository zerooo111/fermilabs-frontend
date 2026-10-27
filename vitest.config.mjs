// Unit tests run in node. Only the `@` alias is shared with vite.config.js:
// its anchor ESM alias and node polyfills are for the browser bundle.
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
