declare module 'cloudflare:workers' {
  export const env: {
    OPENAI_API_KEY?: string
    OPENAI_MODEL?: string
    CLOUDFLARE_ACCOUNT_ID?: string
    CLOUDFLARE_API_TOKEN?: string
    WORKERS_AI_MODEL?: string
  }
}
