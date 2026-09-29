import {
  isPlateAppearanceResult,
  isResolved,
  type Cell,
  type CellField,
  type GameRecord,
  type ReviewField,
} from './model'
import { slotInBattingOrder } from './roster'

export interface ReviewItem {
  batterId: string
  /** null for `name` items. */
  plateAppearanceId: string | null
  field: ReviewField
  confidence: Cell<unknown>['confidence']
  extractedValue: unknown
  battingOrder: number
  /** Position among players sharing the batting order; 2 = first substitute. */
  slot: number
}

export type Correction =
  | { plateAppearanceId: string; field: CellField; value: unknown }
  | { batterId: string; field: 'name'; value: unknown }

export const MAX_NAME_LENGTH = 40

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
    const position = { battingOrder: batter.battingOrder, slot: slotInBattingOrder(record.batters, batter) }
    if (!batter.playerId) {
      items.push({
        batterId: batter.id,
        plateAppearanceId: null,
        field: 'name',
        confidence: batter.name.confidence,
        extractedValue: batter.name.value,
        ...position,
      })
    }
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
            ...position,
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
  const batters = new Map(next.batters.map((b) => [b.id, b] as const))

  corrections.forEach((correction, i) => {
    if (correction.field === 'name') {
      const batter = batters.get(correction.batterId)
      if (!batter) throw new CorrectionError(`unknown batterId: ${correction.batterId}`, i)
      const name = typeof correction.value === 'string' ? correction.value.trim() : ''
      if (!name || name.length > MAX_NAME_LENGTH) {
        throw new CorrectionError(`name must be 1-${MAX_NAME_LENGTH} characters`, i)
      }
      batter.name = corrected(name)
      delete batter.playerId
      return
    }
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
        throw new CorrectionError("unknown field", i)
    }
  })
  return next
}
