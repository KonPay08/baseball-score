import {
  isPlateAppearanceResult,
  isResolved,
  type Cell,
  type CellField,
  type GameRecord,
} from './model'

export interface ReviewItem {
  batterId: string
  plateAppearanceId: string
  field: CellField
  confidence: Cell<unknown>['confidence']
  extractedValue: unknown
}

export interface Correction {
  plateAppearanceId: string
  field: CellField
  value: unknown
}

export class CorrectionError extends Error {
  constructor(
    message: string,
    readonly index: number,
  ) {
    super(message)
  }
}

export function listReviewItems(record: GameRecord): ReviewItem[] {
  const items: ReviewItem[] = []
  for (const batter of record.batters) {
    for (const pa of batter.plateAppearances) {
      const fields: [CellField, Cell<unknown>][] = [
        ['result', pa.result],
        ['rbi', pa.rbi],
        ['run', pa.run],
      ]
      for (const [field, cell] of fields) {
        if (!isResolved(cell)) {
          items.push({
            batterId: batter.id,
            plateAppearanceId: pa.id,
            field,
            confidence: cell.confidence,
            extractedValue: cell.value,
          })
        }
      }
    }
  }
  return items
}

function corrected<T>(value: T): Cell<T> {
  return { value, confidence: 'high', source: 'corrected' }
}

function isValidRbi(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 4
}

/** Returns a new record with corrections applied. Throws CorrectionError without partial application. */
export function applyCorrections(record: GameRecord, corrections: Correction[]): GameRecord {
  const next: GameRecord = structuredClone(record)
  const index = new Map(
    next.batters.flatMap((b) => b.plateAppearances.map((pa) => [pa.id, pa] as const)),
  )

  corrections.forEach((correction, i) => {
    const pa = index.get(correction.plateAppearanceId)
    if (!pa) throw new CorrectionError(`unknown plateAppearanceId: ${correction.plateAppearanceId}`, i)
    const { value } = correction
    switch (correction.field) {
      case 'result':
        if (!isPlateAppearanceResult(value)) {
          throw new CorrectionError('result must be a known plate appearance code', i)
        }
        pa.result = corrected(value)
        break
      case 'rbi':
        if (!isValidRbi(value)) throw new CorrectionError('rbi must be an integer between 0 and 4', i)
        pa.rbi = corrected(value)
        break
      case 'run':
        if (typeof value !== 'boolean') throw new CorrectionError('run must be a boolean', i)
        pa.run = corrected(value)
        break
      default:
        throw new CorrectionError(`unknown field: ${String(correction.field)}`, i)
    }
  })
  return next
}
