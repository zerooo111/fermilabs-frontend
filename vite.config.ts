import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), nodePolyfills()],
  server: {
    port: 4000,
    host: true,
    headers: {
      'Content-Type': 'application/javascript',
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: id => {
          // Core vendor libraries
          if (id.includes('node_modules')) {
            if (
              id.includes('react') ||
              id.includes('react-dom') ||
              id.includes('react-router-dom')
            ) {
              return 'vendor-react';
            }
            if (id.includes('@radix-ui')) {
              return 'vendor-ui';
            }
            if (id.includes('@solana') || id.includes('@coral-xyz') || id.includes('anchor')) {
              return 'vendor-blockchain';
            }
            if (id.includes('@tanstack') || id.includes('jotai') || id.includes('zod')) {
              return 'vendor-state';
            }
            if (id.includes('lightweight-charts')) {
              return 'vendor-charts';
            }
            // All other node_modules
            return 'vendor-other';
          }

          // Application code
          if (id.includes('/features/chart/')) {
            return 'feature-chart';
          }
          if (id.includes('/features/order-placement/')) {
            return 'feature-order-placement';
          }
          if (id.includes('/features/vault-deposit/')) {
            return 'feature-vault';
          }
          if (id.includes('/shared/')) {
            return 'shared';
          }
          if (id.includes('/entities/')) {
            return 'entities';
          }
        },
      },
    },
    sourcemap: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
