import { ExtractionError, sampleExtractor, type ScoreSheetExtractor } from './extractor'
import { WORKERS_AI_VISION_CANDIDATES, createRestRunner, createWorkersAiExtractor } from './workersAi'

export const DEFAULT_WORKERS_AI_MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct'

export interface ExtractorEnv {
  CLOUDFLARE_ACCOUNT_ID?: string
  CLOUDFLARE_API_TOKEN?: string
  WORKERS_AI_MODEL?: string
}

/** Uses Workers AI when both Cloudflare credentials are set, otherwise the fixed sample extractor. */
export function selectExtractor(env: ExtractorEnv): ScoreSheetExtractor {
  const { CLOUDFLARE_ACCOUNT_ID: accountId, CLOUDFLARE_API_TOKEN: apiToken } = env
  if (!accountId || !apiToken) return sampleExtractor
  const model = env.WORKERS_AI_MODEL || DEFAULT_WORKERS_AI_MODEL
  const candidate = WORKERS_AI_VISION_CANDIDATES.find((c) => c.model === model)
  if (!candidate) {
    return {
      name: `workers-ai:${model}`,
      async extract() {
        throw new ExtractionError(`WORKERS_AI_MODEL is not a supported model: ${model}`)
      },
    }
  }
  return createWorkersAiExtractor(candidate, createRestRunner({ accountId, apiToken }))
}
