/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_PASSWORD?: string;
  readonly VITE_BASE?: string;
  readonly VITE_STORAGE_MODE?: 'none' | 'supabase' | 'rest';
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_STORAGE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// build 時由 vite define 注入的版本號（來源：package.json version）
declare const __APP_VERSION__: string;
