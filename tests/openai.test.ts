import { describe, expect, it } from 'vitest'
import { ExtractionError, type ScoreSheetImage } from '~/server/extractor'
import {
  OPENAI_VISION_CANDIDATES,
  buildOpenAiRequest,
  createOpenAiExtractor,
  readOpenAiResponse,
  runOpenAiExtraction,
  toStrictSchema,
} from '~/server/openai'

const image: ScoreSheetImage = { fileName: 'sheet.png', contentType: 'image/png', bytes: new Uint8Array([1, 2, 3]).buffer }
const [candidate] = OPENAI_VISION_CANDIDATES
const cell = (value: unknown, confidence = 'high') => ({ value, confidence })
const modelJson = {
  teamName: cell('ホークス'),
  opponentName: cell(null, 'unreadable'),
  gameDate: cell('2026-09-27'),
  batters: [{ battingOrder: 1, name: cell('佐藤'), plateAppearances: [{ inning: 1, result: cell('HR'), rbi: cell(1), run: cell(true) }] }],
}
const responseBody = (text: string) => ({
  status: 'completed',
  output: [
    { type: 'reasoning', summary: [] },
    { type: 'message', content: [{ type: 'output_text', text }] },
  ],
  usage: { input_tokens: 1200, output_tokens: 300 },
})

describe('toStrictSchema', () => {
  it('closes every object', () => {
    expect(toStrictSchema({ type: 'object', properties: { a: { type: 'array', items: { type: 'object' } } } })).toEqual({
      type: 'object',
      additionalProperties: false,
      properties: { a: { type: 'array', items: { type: 'object', additionalProperties: false } } },
    })
  })
})

describe('buildOpenAiRequest', () => {
  it('sends the image as input_image and asks for strict JSON schema output', () => {
    const request = buildOpenAiRequest(candidate, image)
    expect(request.model).toBe(candidate.model)
    expect(JSON.stringify(request.input)).toContain('"type":"input_image","image_url":"data:image/png;base64,AQID"')
    expect(request.text).toMatchObject({ format: { type: 'json_schema', strict: true } })
  })
})

describe('readOpenAiResponse', () => {
  it('reads output text and usage', () => {
    expect(readOpenAiResponse(responseBody('{"a":1}'))).toEqual({
      text: '{"a":1}',
      usage: { promptTokens: 1200, completionTokens: 300 },
    })
  })

  it('rejects refusals, incomplete responses and missing text', () => {
    expect(() =>
      readOpenAiResponse({ output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }] }),
    ).toThrow('refused')
    expect(() => readOpenAiResponse({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } })).toThrow(
      'max_output_tokens',
    )
    expect(() => readOpenAiResponse({ output: [] })).toThrow(ExtractionError)
  })
})

describe('runOpenAiExtraction', () => {
  it('posts to the Responses API and maps the JSON into a GameRecord', async () => {
    let captured: { url: string; init: RequestInit } | null = null
    const fakeFetch = (async (url: string, init: RequestInit) => {
      captured = { url, init }
      return new Response(JSON.stringify(responseBody(JSON.stringify(modelJson))), { status: 200 })
    }) as typeof fetch
    const result = await runOpenAiExtraction(candidate, { apiKey: 'sk-test', fetch: fakeFetch }, image)
    expect(captured!.url).toBe('https://api.openai.com/v1/responses')
    expect(new Headers(captured!.init.headers).get('Authorization')).toBe('Bearer sk-test')
    expect(result.record.batters[0].plateAppearances[0].result.value).toBe('HR')
    expect(result.record.opponentName.confidence).toBe('unreadable')
    expect(result.usage.promptTokens).toBe(1200)
  })

  it('throws ExtractionError with the API error message', async () => {
    const fakeFetch = (async () =>
      new Response(JSON.stringify({ error: { message: 'Incorrect API key' } }), { status: 401 })) as unknown as typeof fetch
    const extractor = createOpenAiExtractor(candidate, { apiKey: 'bad', fetch: fakeFetch })
    expect(extractor.name).toBe(`openai:${candidate.model}`)
    await expect(extractor.extract(image)).rejects.toThrow('OpenAI request failed (401) Incorrect API key')
  })
})
