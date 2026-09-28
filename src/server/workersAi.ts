import {
  isPlateAppearanceResult,
  type Batter,
  type Cell,
  type Confidence,
  type GameRecord,
  type PlateAppearanceResult,
  PLATE_APPEARANCE_RESULTS,
} from '~/features/scoresheet/model'
import { ExtractionError, type ScoreSheetExtractor, type ScoreSheetImage } from './extractor'

/**
 * How the image is passed to the model. Workers AI vision models do not share one input format:
 * - `image-field`: `{ messages, image: dataUrl }` (Llama 3.2 Vision tutorial)
 * - `content-parts`: OpenAI style `image_url` part inside the user message
 * Formats are taken from the Cloudflare docs and still need to be confirmed with real calls.
 */
export type ImageInputStyle = 'image-field' | 'content-parts'

export interface WorkersAiCandidate {
  model: string
  inputStyle: ImageInputStyle
  /** USD per 1M tokens, from the Cloudflare model pages (checked 2026-09-28). Used only for cost estimates. */
  pricing: { input: number; output: number }
  extraInput?: Record<string, unknown>
}

export const WORKERS_AI_VISION_CANDIDATES: readonly WorkersAiCandidate[] = [
  { model: '@cf/meta/llama-3.2-11b-vision-instruct', inputStyle: 'image-field', pricing: { input: 0.049, output: 0.68 } },
  { model: '@cf/meta/llama-4-scout-17b-16e-instruct', inputStyle: 'content-parts', pricing: { input: 0.27, output: 0.85 } },
  { model: '@cf/google/gemma-3-12b-it', inputStyle: 'content-parts', pricing: { input: 0.35, output: 0.56 } },
  { model: '@cf/mistralai/mistral-small-3.1-24b-instruct', inputStyle: 'content-parts', pricing: { input: 0.351, output: 0.555 } },
  {
    model: '@cf/qwen/qwen3.8-27b',
    inputStyle: 'content-parts',
    pricing: { input: 0.45, output: 3.2 },
    extraInput: { reasoning_effort: 'low' },
  },
]

/** Calls a Workers AI model and returns the `result` payload (binding and REST API return the same shape). */
export type ModelRunner = (model: string, input: Record<string, unknown>) => Promise<unknown>

export interface TokenUsage {
  promptTokens: number | null
  completionTokens: number | null
}

export interface WorkersAiExtraction {
  record: GameRecord
  rawText: string
  usage: TokenUsage
}

const CONFIDENCE_VALUES: readonly Confidence[] = ['high', 'low', 'unreadable']

const cellSchema = (valueType: 'string' | 'integer' | 'boolean', enumValues?: readonly string[]) => ({
  type: 'object',
  properties: {
    value: enumValues ? { type: ['string', 'null'], enum: [...enumValues, null] } : { type: [valueType, 'null'] },
    confidence: { type: 'string', enum: CONFIDENCE_VALUES },
  },
  required: ['value', 'confidence'],
})

export const EXTRACTION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    teamName: cellSchema('string'),
    opponentName: cellSchema('string'),
    gameDate: cellSchema('string'),
    batters: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          battingOrder: { type: 'integer' },
          name: cellSchema('string'),
          plateAppearances: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                inning: { type: 'integer' },
                result: cellSchema('string', PLATE_APPEARANCE_RESULTS),
                rbi: cellSchema('integer'),
                run: cellSchema('boolean'),
              },
              required: ['inning', 'result', 'rbi', 'run'],
            },
          },
        },
        required: ['battingOrder', 'name', 'plateAppearances'],
      },
    },
  },
  required: ['teamName', 'opponentName', 'gameDate', 'batters'],
} as const

export const EXTRACTION_PROMPT = [
  'あなたは少年野球の手書きスコア表を読み取るアシスタントです。',
  '画像から自チームの打撃記録を読み取り、指定の JSON だけを返してください。',
  '各項目は { "value": 値, "confidence": "high" | "low" | "unreadable" } で返します。',
  '読めない・自信がない項目を推測で埋めないでください。読めない場合は value を null、confidence を "unreadable" にします。',
  'batters は打順ごとに1件、plateAppearances は打席ごとに1件で、inning はその打席のイニングです。',
  `result は次のコードのいずれかです: ${PLATE_APPEARANCE_RESULTS.join(', ')}`,
  '（1B=単打, 2B=二塁打, 3B=三塁打, HR=本塁打, BB=四球, HBP=死球, K=三振, OUT=凡打, SH=犠打, SF=犠飛, E=失策出塁, FC=野選, INT=打撃妨害）',
  'rbi はその打席の打点（整数）、run はその打者が得点したかどうかです。gameDate は YYYY-MM-DD です。',
].join('\n')

export function toDataUrl(image: ScoreSheetImage): string {
  const bytes = new Uint8Array(image.bytes)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return `data:${image.contentType};base64,${btoa(binary)}`
}

export function buildModelInput(candidate: WorkersAiCandidate, image: ScoreSheetImage): Record<string, unknown> {
  const dataUrl = toDataUrl(image)
  const instruction = 'このスコア表を読み取ってください。'
  const messages =
    candidate.inputStyle === 'image-field'
      ? [
          { role: 'system', content: EXTRACTION_PROMPT },
          { role: 'user', content: instruction },
        ]
      : [
          { role: 'system', content: EXTRACTION_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: instruction },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ]
  return {
    messages,
    ...(candidate.inputStyle === 'image-field' ? { image: dataUrl } : {}),
    response_format: { type: 'json_schema', json_schema: EXTRACTION_JSON_SCHEMA },
    max_tokens: 4096,
    temperature: 0,
    ...candidate.extraInput,
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** Pulls the generated content and token usage out of either the native or the OpenAI compatible result shape. */
export function readModelResult(result: unknown): { content: unknown; usage: TokenUsage } {
  if (!isObject(result)) throw new ExtractionError('model returned an unexpected response')
  const usage = isObject(result.usage) ? result.usage : {}
  const tokenUsage: TokenUsage = {
    promptTokens: numberOrNull(usage.prompt_tokens),
    completionTokens: numberOrNull(usage.completion_tokens),
  }
  if ('response' in result) return { content: result.response, usage: tokenUsage }
  const choices = Array.isArray(result.choices) ? result.choices : []
  const first: unknown = choices[0]
  if (isObject(first) && isObject(first.message)) return { content: first.message.content, usage: tokenUsage }
  throw new ExtractionError('model response has no content')
}

function parseJsonContent(content: unknown): unknown {
  if (typeof content !== 'string') return content
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    throw new ExtractionError('model response is not valid JSON')
  }
}

function toCell<T>(raw: unknown, accept: (value: unknown) => value is T): Cell<T> {
  const value = isObject(raw) ? raw.value : undefined
  const confidence = isObject(raw) && CONFIDENCE_VALUES.includes(raw.confidence as Confidence)
    ? (raw.confidence as Confidence)
    : 'low'
  if (value === null || value === undefined || !accept(value)) {
    return { value: null, confidence: 'unreadable', source: 'extracted' }
  }
  return { value, confidence, source: 'extracted' }
}

const isString = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''
const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean'
const isRbi = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 4
const isResult = (v: unknown): v is PlateAppearanceResult => isPlateAppearanceResult(v)

/**
 * Converts model JSON into a GameRecord. Values outside the domain (unknown result codes, invalid RBI, ...)
 * become unreadable cells so that they are reviewed instead of being counted.
 */
export function parseModelOutput(content: unknown): GameRecord {
  const data = parseJsonContent(content)
  if (!isObject(data) || !Array.isArray(data.batters)) {
    throw new ExtractionError('model response does not contain batters')
  }
  const batters: Batter[] = data.batters.filter(isObject).map((raw, index) => {
    const battingOrder =
      typeof raw.battingOrder === 'number' && Number.isInteger(raw.battingOrder) ? raw.battingOrder : index + 1
    const id = `b${index + 1}`
    const pas = Array.isArray(raw.plateAppearances) ? raw.plateAppearances.filter(isObject) : []
    return {
      id,
      battingOrder,
      name: toCell(raw.name, isString),
      plateAppearances: pas.map((pa, paIndex) => ({
        id: `${id}-pa${paIndex + 1}`,
        inning: typeof pa.inning === 'number' && Number.isInteger(pa.inning) ? pa.inning : 0,
        result: toCell(pa.result, isResult),
        rbi: toCell(pa.rbi, isRbi),
        run: toCell(pa.run, isBoolean),
      })),
    }
  })
  return {
    teamName: toCell(data.teamName, isString),
    opponentName: toCell(data.opponentName, isString),
    gameDate: toCell(data.gameDate, isString),
    batters,
  }
}

export async function runWorkersAiExtraction(
  candidate: WorkersAiCandidate,
  run: ModelRunner,
  image: ScoreSheetImage,
): Promise<WorkersAiExtraction> {
  const result = await run(candidate.model, buildModelInput(candidate, image))
  const { content, usage } = readModelResult(result)
  const rawText = typeof content === 'string' ? content : JSON.stringify(content)
  return { record: parseModelOutput(content), rawText, usage }
}

export function createWorkersAiExtractor(candidate: WorkersAiCandidate, run: ModelRunner): ScoreSheetExtractor {
  return {
    name: `workers-ai:${candidate.model}`,
    async extract(image) {
      return (await runWorkersAiExtraction(candidate, run, image)).record
    },
  }
}

/** Runner using the Workers AI REST API (`/accounts/:id/ai/run/:model`). Used by the evaluation script. */
export function createRestRunner(options: {
  accountId: string
  apiToken: string
  fetch?: typeof fetch
}): ModelRunner {
  const doFetch = options.fetch ?? fetch
  return async (model, input) => {
    const res = await doFetch(
      `https://api.cloudflare.com/client/v4/accounts/${options.accountId}/ai/run/${model}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${options.apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      },
    )
    const body: unknown = await res.json().catch(() => null)
    if (!res.ok || !isObject(body) || body.success === false) {
      const errors = isObject(body) && Array.isArray(body.errors) ? JSON.stringify(body.errors) : ''
      throw new ExtractionError(`Workers AI request failed (${res.status}) ${errors}`.trim())
    }
    return body.result
  }
}
