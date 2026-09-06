import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// base 可透過 VITE_BASE 設定；GitHub Pages 專案頁需設成 "/repo-name/"，預設 "/"。
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: env.VITE_BASE || '/',
    plugins: [react()],
  };
});
