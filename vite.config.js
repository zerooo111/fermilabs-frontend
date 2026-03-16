import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), nodePolyfills()],
  server: {
    host: '0.0.0.0',
    port: 8070,
    strictPort: true,
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
    proxy: {
      '/harness': {
        target: 'http://127.0.0.1:9091',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/harness/, ''),
      },
      '/bridge': {
        target: 'http://127.0.0.1:9092',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/bridge/, ''),
      },
      '/solana-rpc': {
        target: 'http://127.0.0.1:8899',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/solana-rpc/, ''),
      },
      '/solana-ws': {
        target: 'ws://127.0.0.1:8900',
        ws: true,
        changeOrigin: true,
        rewrite: path => path.replace(/^\/solana-ws/, ''),
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 8070,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@mango-v4-client': path.resolve(__dirname, '../mng-v4/ts/client/src'),
    },
  },
});
