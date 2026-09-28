import { describe, expect, it } from 'vitest'
import { sampleExtractor } from '~/server/extractor'
import { DEFAULT_WORKERS_AI_MODEL, selectExtractor } from '~/server/extractorConfig'

const image = { fileName: 'sheet.jpg', contentType: 'image/jpeg', bytes: new ArrayBuffer(1) }

describe('selectExtractor', () => {
  it('falls back to the sample extractor without both credentials', () => {
    expect(selectExtractor({})).toBe(sampleExtractor)
    expect(selectExtractor({ CLOUDFLARE_ACCOUNT_ID: 'acc' })).toBe(sampleExtractor)
    expect(selectExtractor({ CLOUDFLARE_API_TOKEN: 'tok' })).toBe(sampleExtractor)
  })

  it('uses the default Workers AI model when credentials are set', () => {
    const extractor = selectExtractor({ CLOUDFLARE_ACCOUNT_ID: 'acc', CLOUDFLARE_API_TOKEN: 'tok' })
    expect(extractor.name).toBe(`workers-ai:${DEFAULT_WORKERS_AI_MODEL}`)
  })

  it('honours WORKERS_AI_MODEL', () => {
    const extractor = selectExtractor({
      CLOUDFLARE_ACCOUNT_ID: 'acc',
      CLOUDFLARE_API_TOKEN: 'tok',
      WORKERS_AI_MODEL: '@cf/google/gemma-3-12b-it',
    })
    expect(extractor.name).toBe('workers-ai:@cf/google/gemma-3-12b-it')
  })

  it('fails extraction for an unsupported model', async () => {
    const extractor = selectExtractor({
      CLOUDFLARE_ACCOUNT_ID: 'acc',
      CLOUDFLARE_API_TOKEN: 'tok',
      WORKERS_AI_MODEL: '@cf/unknown/model',
    })
    await expect(extractor.extract(image)).rejects.toThrow('WORKERS_AI_MODEL')
  })
})
