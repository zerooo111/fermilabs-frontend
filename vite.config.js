import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';
import { execSync } from 'child_process';

// One id per build, baked into the bundle and published as /version.json so a
// running tab can tell when a newer deploy is live (see useNewVersionToast).
const commit = (() => {
  if (process.env.CF_PAGES_COMMIT_SHA) return process.env.CF_PAGES_COMMIT_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
})();
const BUILD_ID = `${commit}-${Date.now().toString(36)}`;

/** Emits dist/version.json with the build id. */
const versionFile = () => ({
  name: 'fermi-version-file',
  apply: 'build',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: JSON.stringify({ build: BUILD_ID }),
    });
  },
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), nodePolyfills(), versionFile()],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  server: {
    host: '0.0.0.0',
    port: 8070,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 8070,
    strictPort: true,
  },
  resolve: {
    alias: [
      // Anchor's browser entry strips the `Wallet` class, which @blockworks-foundation/mango-v4
      // imports statically at the top of its client. Force the ESM entry so Wallet is bundled.
      // We never call Wallet on the user's behalf — actual signing happens via the browser
      // wallet adapter (see signIntentMessage in usePerps); MangoClient only uses a read-only
      // stub for IDL/group reads. The regex anchors to the bare specifier so subpath imports
      // like `@coral-xyz/anchor/dist/cjs/nodewallet` still resolve normally.
      {
        find: /^@coral-xyz\/anchor$/,
        replacement: path.resolve(__dirname, './src/shared/lib/anchor-shim.ts'),
      },
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
});
