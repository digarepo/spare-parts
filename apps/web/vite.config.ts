import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tailwindcss(), react(), reactRouter(), tsconfigPaths()],
  css: { transformer: 'postcss' },
  server: {
    proxy: {
      '^/(auth|catalog|health)': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
