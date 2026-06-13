import { defineConfig } from 'vite';

// Configuration minimale : Vite sert simplement le dossier et bundle src/main.js.
export default defineConfig({
  server: {
    port: 5174,
    open: false,
  },
});
