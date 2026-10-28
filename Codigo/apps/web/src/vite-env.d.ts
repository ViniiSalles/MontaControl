/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL da API para o WebSocket de notificações (ver `urlDoSocket`). Ausente: próprio origin. */
  readonly VITE_WS_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
