import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
        'content-chatgpt': resolve(__dirname, 'src/content-scripts/chatgpt.ts'),
        'content-gemini': resolve(__dirname, 'src/content-scripts/gemini.ts'),
        'content-claude': resolve(__dirname, 'src/content-scripts/claude.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].[hash].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
    // 不分割 vendor chunk
    cssCodeSplit: false,
  },
});
