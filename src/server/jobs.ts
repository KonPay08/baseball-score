import type { GameRecord } from '~/features/scoresheet/model'
import { listReviewItems, type ReviewItem } from '~/features/scoresheet/review'
import { calculateBattingStats, type BattingStats } from '~/features/scoresheet/stats'
import { ExtractionError, type ScoreSheetExtractor, type ScoreSheetImage } from './extractor'

export type JobStatus = 'processing' | 'succeeded' | 'failed'

export interface Job {
  id: string
  status: JobStatus
  createdAt: string
  updatedAt: string
  image: { fileName: string; contentType: string; size: number }
  extractor: string
  error: { code: string; message: string } | null
  /** Raw extraction output. Never modified after extraction. */
  extracted: GameRecord | null
  /** Record with user corrections applied; stats are calculated from this. */
  record: GameRecord | null
  revision: number
}

export interface JobView extends Omit<Job, 'extracted'> {
  reviewItems: ReviewItem[]
  battingStats: BattingStats[]
}

export interface JobStore {
  get(id: string): Job | undefined
  put(job: Job): void
  findByIdempotencyKey(key: string): Job | undefined
  setIdempotencyKey(key: string, jobId: string): void
}

export function createMemoryJobStore(): JobStore {
  const jobs = new Map<string, Job>()
  const keys = new Map<string, string>()
  return {
    get: (id) => jobs.get(id),
    put: (job) => void jobs.set(job.id, structuredClone(job)),
    findByIdempotencyKey: (key) => {
      const id = keys.get(key)
      return id ? jobs.get(id) : undefined
    },
    setIdempotencyKey: (key, jobId) => void keys.set(key, jobId),
  }
}

export function toJobView(job: Job): JobView {
  const { extracted: _extracted, ...rest } = job
  return {
    ...rest,
    reviewItems: job.record ? listReviewItems(job.record) : [],
    battingStats: job.record ? calculateBattingStats(job.record) : [],
  }
}

export async function runExtraction(
  store: JobStore,
  extractor: ScoreSheetExtractor,
  job: Job,
  image: ScoreSheetImage,
): Promise<Job> {
  const now = () => new Date().toISOString()
  try {
    const extracted = await extractor.extract(image)
    const done: Job = {
      ...job,
      status: 'succeeded',
      extracted,
      record: structuredClone(extracted),
      updatedAt: now(),
    }
    store.put(done)
    return done
  } catch (e) {
    const failed: Job = {
      ...job,
      status: 'failed',
      error: {
        code: e instanceof ExtractionError ? 'extraction_failed' : 'internal_error',
        message: e instanceof Error ? e.message : 'unknown error',
      },
      updatedAt: now(),
    }
    store.put(failed)
    return failed
  }
}
