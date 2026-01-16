import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    target: 'es2020',
    outDir: '../public-v2',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          terminal: [
            './src/terminal/Terminal.ts',
            './src/terminal/Renderer.ts',
            './src/terminal/VirtualGrid.ts',
            './src/terminal/ANSIParser.ts'
          ]
        }
      }
    }
  },
  server: {
    port: 3001,
    proxy: {
      '/api': 'http://localhost:3000',
      '/terminal': {
        target: 'ws://localhost:3000',
        ws: true
      }
    }
  }
});
