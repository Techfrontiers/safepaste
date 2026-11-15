import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Use relative base './' so the compiled bundle works seamlessly on
// Firebase Hosting, GitHub Pages, and inside Chrome Extension sidepanel.html.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
