import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  // OCR/WASM assets must be treated as static files, never bundled.
  optimizeDeps: {
    exclude: ['tesseract.js']
  }
});
