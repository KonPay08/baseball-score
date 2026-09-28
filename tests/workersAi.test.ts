import { describe, expect, it } from 'vitest'
import { ExtractionError, type ScoreSheetImage } from '~/server/extractor'
import {
  WORKERS_AI_VISION_CANDIDATES,
  buildModelInput,
  createRestRunner,
  createWorkersAiExtractor,
  parseModelOutput,
  readModelResult,
  runWorkersAiExtraction,
  type ModelRunner,
} from '~/server/workersAi'

const image: ScoreSheetImage = {
  fileName: 'sheet.png',
  contentType: 'image/png',
  bytes: new Uint8Array([1, 2, 3]).buffer,
}

const cell = (value: unknown, confidence = 'high') => ({ value, confidence })

const modelJson = {
  teamName: cell('ホークス'),
  opponentName: cell(null, 'unreadable'),
  gameDate: cell('2026-09-27', 'low'),
  batters: [
    {
      battingOrder: 1,
      name: cell('佐藤'),
      plateAppearances: [
        { inning: 1, result: cell('1B'), rbi: cell(0), run: cell(true) },
        { inning: 3, result: cell('ゴロ'), rbi: cell(9), run: cell('yes') },
      ],
    },
  ],
}

const [llama32, scout] = WORKERS_AI_VISION_CANDIDATES

describe('buildModelInput', () => {
  it('passes the image in the style the candidate expects', () => {
    const imageField = buildModelInput(llama32, image)
    expect(imageField.image).toBe('data:image/png;base64,AQID')
    const parts = buildModelInput(scout, image)
    expect(parts.image).toBeUndefined()
    expect(JSON.stringify(parts.messages)).toContain('data:image/png;base64,AQID')
    expect(parts.response_format).toMatchObject({ type: 'json_schema' })
  })
})

describe('readModelResult', () => {
  it('reads native and OpenAI compatible results', () => {
    expect(readModelResult({ response: 'x', usage: { prompt_tokens: 10, completion_tokens: 5 } })).toEqual({
      content: 'x',
      usage: { promptTokens: 10, completionTokens: 5 },
    })
    expect(readModelResult({ choices: [{ message: { content: 'y' } }] })).toEqual({
      content: 'y',
      usage: { promptTokens: null, completionTokens: null },
    })
  })

  it('rejects responses without content', () => {
    expect(() => readModelResult({ foo: 1 })).toThrow(ExtractionError)
  })
})

describe('parseModelOutput', () => {
  it('maps model JSON to cells and turns out-of-domain values into unreadable cells', () => {
    const record = parseModelOutput(modelJson)
    expect(record.opponentName).toEqual({ value: null, confidence: 'unreadable', source: 'extracted' })
    expect(record.gameDate.confidence).toBe('low')
    const [pa1, pa2] = record.batters[0].plateAppearances
    expect(pa1.id).toBe('b1-pa1')
    expect(pa1.result).toEqual({ value: '1B', confidence: 'high', source: 'extracted' })
    expect(pa2.result.value).toBeNull()
    expect(pa2.rbi).toMatchObject({ value: null, confidence: 'unreadable' })
    expect(pa2.run).toMatchObject({ value: null, confidence: 'unreadable' })
  })

  it('accepts JSON text wrapped in a code fence', () => {
    const record = parseModelOutput('```json\n' + JSON.stringify(modelJson) + '\n```')
    expect(record.batters).toHaveLength(1)
  })

  it('fails on non-JSON or missing batters', () => {
    expect(() => parseModelOutput('not json')).toThrow(ExtractionError)
    expect(() => parseModelOutput({ teamName: cell('x') })).toThrow(ExtractionError)
  })
})

describe('extractor', () => {
  it('runs the model through the runner and returns usage', async () => {
    const calls: string[] = []
    const run: ModelRunner = async (model) => {
      calls.push(model)
      return { response: modelJson, usage: { prompt_tokens: 100, completion_tokens: 50 } }
    }
    const result = await runWorkersAiExtraction(scout, run, image)
    expect(calls).toEqual([scout.model])
    expect(result.usage).toEqual({ promptTokens: 100, completionTokens: 50 })
    const extractor = createWorkersAiExtractor(scout, run)
    expect(extractor.name).toBe(`workers-ai:${scout.model}`)
    expect((await extractor.extract(image)).batters).toHaveLength(1)
  })
})

describe('createRestRunner', () => {
  it('calls the REST API and returns result', async () => {
    let url = ''
    let auth = ''
    const run = createRestRunner({
      accountId: 'acc',
      apiToken: 'tok',
      fetch: async (input, init) => {
        url = String(input)
        auth = new Headers(init?.headers).get('Authorization') ?? ''
        return Response.json({ success: true, result: { response: 'ok' } })
      },
    })
    expect(await run('@cf/x/y', {})).toEqual({ response: 'ok' })
    expect(url).toBe('https://api.cloudflare.com/client/v4/accounts/acc/ai/run/@cf/x/y')
    expect(auth).toBe('Bearer tok')
  })

  it('throws ExtractionError on API errors', async () => {
    const run = createRestRunner({
      accountId: 'acc',
      apiToken: 'tok',
      fetch: async () => Response.json({ success: false, errors: [{ message: 'bad' }] }, { status: 400 }),
    })
    await expect(run('@cf/x/y', {})).rejects.toThrow(/400/)
  })
})
