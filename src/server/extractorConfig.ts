import { ExtractionError, sampleExtractor, type ScoreSheetExtractor } from './extractor'
import { OPENAI_VISION_CANDIDATES, createOpenAiExtractor } from './openai'
import { WORKERS_AI_VISION_CANDIDATES, createRestRunner, createWorkersAiExtractor } from './workersAi'

export const DEFAULT_WORKERS_AI_MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct'
export const DEFAULT_OPENAI_MODEL = 'gpt-5.6-terra'

export interface ExtractorEnv {
  OPENAI_API_KEY?: string
  OPENAI_MODEL?: string
  CLOUDFLARE_ACCOUNT_ID?: string
  CLOUDFLARE_API_TOKEN?: string
  WORKERS_AI_MODEL?: string
}

function unsupported(provider: string, variable: string, model: string): ScoreSheetExtractor {
  return {
    name: `${provider}:${model}`,
    async extract() {
      throw new ExtractionError(`${variable} is not a supported model: ${model}`)
    },
  }
}

/**
 * OpenAI when `OPENAI_API_KEY` is set, otherwise Workers AI when both Cloudflare credentials are set,
 * otherwise the fixed sample extractor.
 */
export function selectExtractor(env: ExtractorEnv): ScoreSheetExtractor {
  if (env.OPENAI_API_KEY) {
    const model = env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL
    const candidate = OPENAI_VISION_CANDIDATES.find((c) => c.model === model)
    if (!candidate) return unsupported('openai', 'OPENAI_MODEL', model)
    return createOpenAiExtractor(candidate, { apiKey: env.OPENAI_API_KEY })
  }
  const { CLOUDFLARE_ACCOUNT_ID: accountId, CLOUDFLARE_API_TOKEN: apiToken } = env
  if (!accountId || !apiToken) return sampleExtractor
  const model = env.WORKERS_AI_MODEL || DEFAULT_WORKERS_AI_MODEL
  const candidate = WORKERS_AI_VISION_CANDIDATES.find((c) => c.model === model)
  if (!candidate) return unsupported('workers-ai', 'WORKERS_AI_MODEL', model)
  return createWorkersAiExtractor(candidate, createRestRunner({ accountId, apiToken }))
}
