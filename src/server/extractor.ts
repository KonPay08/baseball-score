import type { GameRecord } from '~/features/scoresheet/model'
import { sampleGameRecord } from '../../fixtures/sample-game-record'

export interface ScoreSheetImage {
  fileName: string
  contentType: string
  bytes: ArrayBuffer
}

export class ExtractionError extends Error {}

export interface ScoreSheetExtractor {
  readonly name: string
  extract(image: ScoreSheetImage): Promise<GameRecord>
}

/**
 * Returns a fixed sample record regardless of the image. Real AI extraction is not selected yet.
 * A file name containing "fail" simulates an extraction failure so error handling can be exercised.
 */
export const sampleExtractor: ScoreSheetExtractor = {
  name: 'sample-fixture',
  async extract(image) {
    if (image.fileName.toLowerCase().includes('fail')) {
      throw new ExtractionError('score sheet could not be recognized')
    }
    return structuredClone(sampleGameRecord)
  },
}
