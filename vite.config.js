import { fileURLToPath, URL } from 'node:url';
export default {
  // project root (where index.html lives)
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src/js', import.meta.url)) }
  },
  root: '.',
  // folder to copy as-is (images, favicon, etc.)
  publicDir: 'public',
  build: { outDir: 'dist' },
  server: { port: 5173 }
};
