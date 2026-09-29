import { ExtractionError, type ScoreSheetExtractor, type ScoreSheetImage } from './extractor'
import {
  EXTRACTION_JSON_SCHEMA,
  EXTRACTION_PROMPT,
  parseModelOutput,
  toDataUrl,
  type TokenUsage,
  type WorkersAiExtraction,
} from './workersAi'

export interface OpenAiCandidate {
  model: string
  /** USD per 1M tokens, from https://developers.openai.com/api/docs/pricing (checked 2026-09-29). Used only for cost estimates. */
  pricing: { input: number; output: number }
}

export const OPENAI_VISION_CANDIDATES: readonly OpenAiCandidate[] = [
  { model: 'gpt-5.6-sol', pricing: { input: 5, output: 30 } },
  { model: 'gpt-5.6-terra', pricing: { input: 2.5, output: 15 } },
  { model: 'gpt-5.6-luna', pricing: { input: 1, output: 6 } },
  { model: 'gpt-5.4-mini', pricing: { input: 0.75, output: 4.5 } },
]

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses'

/** Strict Structured Outputs require `additionalProperties: false` on every object. */
export function toStrictSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toStrictSchema)
  if (typeof schema !== 'object' || schema === null) return schema
  const entries = Object.entries(schema).map(([key, value]) => [key, toStrictSchema(value)] as const)
  const result: Record<string, unknown> = Object.fromEntries(entries)
  if (result.type === 'object') result.additionalProperties = false
  return result
}

export function buildOpenAiRequest(candidate: OpenAiCandidate, image: ScoreSheetImage): Record<string, unknown> {
  return {
    model: candidate.model,
    instructions: EXTRACTION_PROMPT,
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: 'このスコア表を読み取ってください。' },
          { type: 'input_image', image_url: toDataUrl(image), detail: 'high' },
        ],
      },
    ],
    text: {
      format: { type: 'json_schema', name: 'score_sheet', strict: true, schema: toStrictSchema(EXTRACTION_JSON_SCHEMA) },
    },
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** Reads the output text and token usage from a Responses API body. */
export function readOpenAiResponse(body: unknown): { text: string; usage: TokenUsage } {
  if (!isObject(body)) throw new ExtractionError('OpenAI returned an unexpected response')
  if (body.status === 'incomplete') {
    const reason = isObject(body.incomplete_details) ? body.incomplete_details.reason : null
    throw new ExtractionError(`OpenAI response is incomplete (${String(reason ?? 'unknown')})`)
  }
  const usage = isObject(body.usage) ? body.usage : {}
  const tokenUsage: TokenUsage = {
    promptTokens: numberOrNull(usage.input_tokens),
    completionTokens: numberOrNull(usage.output_tokens),
  }
  const parts = (Array.isArray(body.output) ? body.output : [])
    .filter((item): item is Record<string, unknown> => isObject(item) && item.type === 'message')
    .flatMap((item) => (Array.isArray(item.content) ? item.content.filter(isObject) : []))
  const refusal = parts.find((p) => p.type === 'refusal')
  if (refusal) throw new ExtractionError(`OpenAI refused: ${String(refusal.refusal)}`)
  const text = parts
    .filter((p) => p.type === 'output_text' && typeof p.text === 'string')
    .map((p) => p.text as string)
    .join('')
  if (!text) throw new ExtractionError('OpenAI response has no output text')
  return { text, usage: tokenUsage }
}

export async function runOpenAiExtraction(
  candidate: OpenAiCandidate,
  options: { apiKey: string; fetch?: typeof fetch },
  image: ScoreSheetImage,
): Promise<WorkersAiExtraction> {
  const doFetch = options.fetch ?? fetch
  const res = await doFetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${options.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(buildOpenAiRequest(candidate, image)),
  })
  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const message = isObject(body) && isObject(body.error) ? String(body.error.message) : ''
    throw new ExtractionError(`OpenAI request failed (${res.status}) ${message}`.trim())
  }
  const { text, usage } = readOpenAiResponse(body)
  return { record: parseModelOutput(text), rawText: text, usage }
}

export function createOpenAiExtractor(
  candidate: OpenAiCandidate,
  options: { apiKey: string; fetch?: typeof fetch },
): ScoreSheetExtractor {
  return {
    name: `openai:${candidate.model}`,
    async extract(image) {
      return (await runOpenAiExtraction(candidate, options, image)).record
    },
  }
}
