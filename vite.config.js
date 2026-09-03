import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

import { parsePublicEnv } from './src/config/parsePublicEnv.js';

export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    parsePublicEnv(loadEnv(mode, process.cwd(), 'VITE_'));
  }

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
    },
    preview: {
      port: 4173,
    },
    test: {
      css: true,
      environment: 'jsdom',
      env: {
        VITE_API_URL: 'http://localhost:3000/api',
        VITE_APP_NAME: 'BudgetApp Test',
        VITE_ENABLE_GOOGLE_LOGIN: 'false',
        VITE_ENABLE_WEB_PUSH: 'false',
      },
      setupFiles: ['./src/test/setup.js'],
    },
  };
});
