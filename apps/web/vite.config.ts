import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Use relative base './' so the compiled bundle works seamlessly on
// Firebase Hosting, GitHub Pages, and inside Chrome Extension sidepanel.html.
export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';
  return {
    plugins: [react()],
    base: './',
    define: isProd
      ? {
          'import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN': JSON.stringify(''),
          'import.meta.env.VITE_FIREBASE_USE_DEBUG_APPCHECK': JSON.stringify('false'),
        }
      : undefined,
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  };
});
