import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// 從 package.json 讀版本號，注入前端頁尾顯示（單一版本來源）。
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8')) as {
  version: string;
};

// base 可透過 VITE_BASE 設定；GitHub Pages 專案頁需設成 "/repo-name/"，預設 "/"。
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: env.VITE_BASE || '/',
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [react()],
  };
});
