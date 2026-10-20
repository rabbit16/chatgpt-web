/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV: string
  readonly VITE_APP_REQUEST_HOST: string
  readonly VITE_LLM_BASE_URL: string
  readonly VITE_SUPPORT_PHONE?: string
  readonly VITE_ADMIN_PHONES?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module 'katex'
