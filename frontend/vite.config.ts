import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA': JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA || 'development'),
  },
  test: {
    // Run tests in a simulated browser environment (jsdom)
    environment: 'jsdom',
    // Allow using describe/it/expect without importing them
    globals: true,
    // Run this file before every test suite — sets up React Testing Library
    setupFiles: './src/test/setup.ts',
    // Exclude Playwright E2E tests — those run via `npm run test:e2e`
    exclude: ['e2e/**', 'node_modules/**'],
  },
});

