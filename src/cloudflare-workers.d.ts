declare module 'cloudflare:workers' {
  export const env: {
    CLOUDFLARE_ACCOUNT_ID?: string
    CLOUDFLARE_API_TOKEN?: string
    WORKERS_AI_MODEL?: string
  }
}
