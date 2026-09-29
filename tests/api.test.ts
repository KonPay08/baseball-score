import { beforeEach, describe, expect, it } from 'vitest'
import { correctRecord, createJob, getExtraction, getJob, listPlayers, type ApiDeps } from '~/server/api'
import { sampleExtractor } from '~/server/extractor'
import { createMemoryJobStore, type JobView } from '~/server/jobs'
import { createMemoryRosterStore } from '~/server/roster'
import { sampleGameRecord } from '../fixtures/sample-game-record'

let deps: ApiDeps

beforeEach(() => {
  const players = sampleGameRecord.batters.map((b) => ({ id: `p-${b.id}`, name: b.name.value ?? '' }))
  deps = { store: createMemoryJobStore(), extractor: sampleExtractor, roster: createMemoryRosterStore(players) }
})

function uploadRequest(file: File | null, headers: Record<string, string> = {}) {
  const form = new FormData()
  if (file) form.append('image', file)
  return new Request('http://test/api/jobs', { method: 'POST', body: form, headers })
}

const png = (name = 'sheet.png', size = 16) => new File([new Uint8Array(size)], name, { type: 'image/png' })

async function jobOf(res: Response): Promise<JobView> {
  return ((await res.json()) as { job: JobView }).job
}

function patchRequest(body: unknown) {
  return new Request('http://test', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/jobs', () => {
  it('creates a succeeded job with review items and stats', async () => {
    const res = await createJob(uploadRequest(png()), deps)
    expect(res.status).toBe(201)
    const job = await jobOf(res)
    expect(job.status).toBe('succeeded')
    expect(job.revision).toBe(0)
    expect(job.reviewItems).toHaveLength(5)
    expect(job.battingStats).toHaveLength(9)
    expect(job).not.toHaveProperty('extracted')
  })

  it('validates input', async () => {
    expect((await createJob(uploadRequest(null), deps)).status).toBe(400)
    expect((await createJob(uploadRequest(png('a.png', 0)), deps)).status).toBe(400)
    const pdf = new File([new Uint8Array(4)], 'a.pdf', { type: 'application/pdf' })
    const res = await createJob(uploadRequest(pdf), deps)
    expect(res.status).toBe(415)
    expect(await res.json()).toMatchObject({ error: { code: 'unsupported_media_type' } })
    const json = new Request('http://test', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } })
    expect((await createJob(json, deps)).status).toBe(400)
  })

  it('returns the same job for a repeated Idempotency-Key', async () => {
    const first = await jobOf(await createJob(uploadRequest(png(), { 'Idempotency-Key': 'k1' }), deps))
    const res = await createJob(uploadRequest(png(), { 'Idempotency-Key': 'k1' }), deps)
    expect(res.status).toBe(200)
    expect((await jobOf(res)).id).toBe(first.id)
  })

  it('records extraction failures on the job', async () => {
    const job = await jobOf(await createJob(uploadRequest(png('fail.png')), deps))
    expect(job.status).toBe('failed')
    expect(job.error?.code).toBe('extraction_failed')
    const patch = await correctRecord(job.id, patchRequest({ expectedRevision: 0, corrections: [] }), deps)
    expect(patch.status).toBe(409)
  })
})

describe('GET /api/jobs/:id', () => {
  it('returns 404 for unknown jobs', async () => {
    expect(getJob('missing', deps).status).toBe(404)
    expect(getExtraction('missing', deps).status).toBe(404)
  })
})

describe('PATCH /api/jobs/:id/record', () => {
  it('applies corrections, recalculates stats and keeps the raw extraction', async () => {
    const created = await jobOf(await createJob(uploadRequest(png()), deps))
    const res = await correctRecord(
      created.id,
      patchRequest({
        expectedRevision: 0,
        corrections: [{ plateAppearanceId: 'b5-pa3', field: 'result', value: '1B' }],
      }),
      deps,
    )
    expect(res.status).toBe(200)
    const job = await jobOf(res)
    expect(job.revision).toBe(1)
    expect(job.reviewItems).toHaveLength(4)
    expect(job.battingStats.find((s) => s.batterId === 'b5')).toMatchObject({ hits: 2, complete: true })

    const raw = (await getExtraction(created.id, deps).json()) as {
      extracted: { batters: { plateAppearances: { id: string; result: { value: unknown } }[] }[] }
    }
    const pa = raw.extracted.batters[4].plateAppearances.find((p) => p.id === 'b5-pa3')
    expect(pa?.result.value).toBeNull()
  })

  it('rejects stale revisions and invalid corrections', async () => {
    const created = await jobOf(await createJob(uploadRequest(png()), deps))
    const correction = { plateAppearanceId: 'b5-pa3', field: 'result', value: '1B' }
    await correctRecord(created.id, patchRequest({ expectedRevision: 0, corrections: [correction] }), deps)

    const stale = await correctRecord(created.id, patchRequest({ expectedRevision: 0, corrections: [correction] }), deps)
    expect(stale.status).toBe(409)
    expect(await stale.json()).toMatchObject({ error: { code: 'revision_conflict', details: { currentRevision: 1 } } })

    const invalid = await correctRecord(
      created.id,
      patchRequest({ expectedRevision: 1, corrections: [{ plateAppearanceId: 'b1-pa1', field: 'rbi', value: -1 }] }),
      deps,
    )
    expect(invalid.status).toBe(422)

    const badField = await correctRecord(
      created.id,
      patchRequest({ expectedRevision: 1, corrections: [{ plateAppearanceId: 'b1-pa1', field: 'name', value: 'x' }] }),
      deps,
    )
    expect(badField.status).toBe(400)
  })
})

describe('roster', () => {
  it('asks for unmatched names, registers entered names and matches them on the next upload', async () => {
    deps = { ...deps, roster: createMemoryRosterStore() }
    const created = await jobOf(await createJob(uploadRequest(png()), deps))
    expect(created.reviewItems.filter((i) => i.field === 'name')).toHaveLength(9)

    const res = await correctRecord(
      created.id,
      patchRequest({ expectedRevision: 0, corrections: [{ batterId: 'b1', field: 'name', value: '佐藤 大翔' }] }),
      deps,
    )
    const job = await jobOf(res)
    expect(job.record?.batters[0].playerId).toBeDefined()
    expect(job.reviewItems.filter((i) => i.field === 'name')).toHaveLength(8)
    const { players } = (await (await listPlayers(deps)).json()) as { players: { name: string }[] }
    expect(players.map((p) => p.name)).toEqual(['佐藤 大翔'])

    const next = await jobOf(await createJob(uploadRequest(png()), deps))
    expect(next.record?.batters[0].playerId).toBe(job.record?.batters[0].playerId)
  })

  it('passes roster names to the extractor', async () => {
    let received: readonly string[] = []
    deps = {
      ...deps,
      extractor: {
        name: 'spy',
        async extract(image, context) {
          received = context?.rosterNames ?? []
          return sampleExtractor.extract(image)
        },
      },
    }
    await createJob(uploadRequest(png()), deps)
    expect(received).toContain('佐藤 大翔')
  })
})
