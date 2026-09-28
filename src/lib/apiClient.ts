import type { CellField } from '~/features/scoresheet/model'
import type { JobView } from '~/server/jobs'

export interface ApiError {
  code: string
  message: string
  details?: unknown
}

async function parse(res: Response): Promise<JobView> {
  const body = (await res.json()) as { job?: JobView; error?: ApiError }
  if (!res.ok || !body.job) {
    throw new Error(body.error ? `${body.error.code}: ${body.error.message}` : `HTTP ${res.status}`)
  }
  return body.job
}

export async function uploadScoreSheet(file: File, idempotencyKey: string): Promise<JobView> {
  const form = new FormData()
  form.append('image', file)
  const res = await fetch('/api/jobs', {
    method: 'POST',
    body: form,
    headers: { 'Idempotency-Key': idempotencyKey },
  })
  return parse(res)
}

export async function submitCorrections(
  jobId: string,
  expectedRevision: number,
  corrections: { plateAppearanceId: string; field: CellField; value: unknown }[],
): Promise<JobView> {
  const res = await fetch(`/api/jobs/${jobId}/record`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expectedRevision, corrections }),
  })
  return parse(res)
}
