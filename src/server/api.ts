import { applyCorrections, CorrectionError, type Correction } from '~/features/scoresheet/review'
import type { ScoreSheetExtractor } from './extractor'
import { runExtraction, toJobView, type Job, type JobStore } from './jobs'
import type { RosterStore } from './roster'

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

export interface ApiDeps {
  store: JobStore
  extractor: ScoreSheetExtractor
  roster: RosterStore
}

export function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return Response.json({ error: { code, message, ...(details === undefined ? {} : { details }) } }, { status })
}

export async function createJob(request: Request, deps: ApiDeps): Promise<Response> {
  const idempotencyKey = request.headers.get('Idempotency-Key')
  if (idempotencyKey) {
    const existing = deps.store.findByIdempotencyKey(idempotencyKey)
    if (existing) return Response.json({ job: toJobView(existing) }, { status: 200 })
  }

  const contentType = request.headers.get('Content-Type') ?? ''
  if (!contentType.startsWith('multipart/form-data')) {
    return errorResponse(400, 'invalid_request', 'request must be multipart/form-data with an "image" field')
  }
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return errorResponse(400, 'invalid_request', 'malformed multipart body')
  }
  const image = form.get('image')
  if (!(image instanceof File)) {
    return errorResponse(400, 'invalid_request', '"image" file field is required')
  }
  if (image.size === 0) return errorResponse(400, 'invalid_request', 'image is empty')
  if (image.size > MAX_IMAGE_BYTES) {
    return errorResponse(413, 'payload_too_large', `image must be at most ${MAX_IMAGE_BYTES} bytes`)
  }
  if (!ACCEPTED_IMAGE_TYPES.includes(image.type)) {
    return errorResponse(415, 'unsupported_media_type', 'unsupported image type', {
      accepted: ACCEPTED_IMAGE_TYPES,
    })
  }

  const now = new Date().toISOString()
  const job: Job = {
    id: crypto.randomUUID(),
    status: 'processing',
    createdAt: now,
    updatedAt: now,
    image: { fileName: image.name, contentType: image.type, size: image.size },
    extractor: deps.extractor.name,
    error: null,
    extracted: null,
    record: null,
    revision: 0,
  }
  deps.store.put(job)
  if (idempotencyKey) deps.store.setIdempotencyKey(idempotencyKey, job.id)

  const players = await deps.roster.list()
  const result = await runExtraction(
    deps.store,
    deps.extractor,
    job,
    { fileName: image.name, contentType: image.type, bytes: await image.arrayBuffer() },
    players,
  )
  return Response.json({ job: toJobView(result) }, { status: 201 })
}

export function getJob(jobId: string, deps: ApiDeps): Response {
  const job = deps.store.get(jobId)
  if (!job) return errorResponse(404, 'not_found', 'job not found')
  return Response.json({ job: toJobView(job) })
}

export function getExtraction(jobId: string, deps: ApiDeps): Response {
  const job = deps.store.get(jobId)
  if (!job) return errorResponse(404, 'not_found', 'job not found')
  return Response.json({ jobId: job.id, extractor: job.extractor, extracted: job.extracted })
}

function parseCorrections(body: unknown): { expectedRevision: number; corrections: Correction[] } | string {
  if (typeof body !== 'object' || body === null) return 'body must be a JSON object'
  const { expectedRevision, corrections } = body as Record<string, unknown>
  if (!Number.isInteger(expectedRevision)) return '"expectedRevision" must be an integer'
  if (!Array.isArray(corrections) || corrections.length === 0) {
    return '"corrections" must be a non-empty array'
  }
  const parsed: Correction[] = []
  for (const [i, c] of corrections.entries()) {
    if (typeof c !== 'object' || c === null) return `corrections[${i}] must be an object`
    const { plateAppearanceId, batterId, field, value } = c as Record<string, unknown>
    if (field === 'name') {
      if (typeof batterId !== 'string') return `corrections[${i}].batterId must be a string`
      parsed.push({ batterId, field, value })
      continue
    }
    if (typeof plateAppearanceId !== 'string') return `corrections[${i}].plateAppearanceId must be a string`
    if (field !== 'result' && field !== 'rbi' && field !== 'run') {
      return `corrections[${i}].field must be one of result, rbi, run, name`
    }
    parsed.push({ plateAppearanceId, field, value })
  }
  return { expectedRevision: expectedRevision as number, corrections: parsed }
}

export async function correctRecord(jobId: string, request: Request, deps: ApiDeps): Promise<Response> {
  const job = deps.store.get(jobId)
  if (!job) return errorResponse(404, 'not_found', 'job not found')
  if (job.status !== 'succeeded' || !job.record) {
    return errorResponse(409, 'job_not_ready', `job is ${job.status}; corrections require a succeeded job`)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse(400, 'invalid_request', 'body must be valid JSON')
  }
  const parsed = parseCorrections(body)
  if (typeof parsed === 'string') return errorResponse(400, 'invalid_request', parsed)
  if (parsed.expectedRevision !== job.revision) {
    return errorResponse(409, 'revision_conflict', 'job was updated by another request', {
      currentRevision: job.revision,
    })
  }

  try {
    const record = applyCorrections(job.record, parsed.corrections)
    for (const c of parsed.corrections) {
      if (c.field !== 'name') continue
      const batter = record.batters.find((b) => b.id === c.batterId)
      if (!batter?.name.value) continue
      const player = await deps.roster.findOrCreate(batter.name.value)
      batter.playerId = player.id
      batter.name = { ...batter.name, value: player.name }
    }
    const updated: Job = { ...job, record, revision: job.revision + 1, updatedAt: new Date().toISOString() }
    deps.store.put(updated)
    return Response.json({ job: toJobView(updated) })
  } catch (e) {
    if (e instanceof CorrectionError) {
      return errorResponse(422, 'invalid_correction', e.message, { index: e.index })
    }
    throw e
  }
}

export async function listPlayers(deps: ApiDeps): Promise<Response> {
  return Response.json({ players: await deps.roster.list() })
}
