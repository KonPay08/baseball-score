import { isPlateAppearanceResult, type Cell, type GameRecord, type PlateAppearanceResult } from './model'
import { listReviewItems } from './review'

/** Hand-labelled correct values for one score sheet. null means the value is blank on the original sheet. */
export interface GroundTruth {
  teamName: string | null
  opponentName: string | null
  gameDate: string | null
  batters: {
    battingOrder: number
    name: string | null
    plateAppearances: { inning: number; result: PlateAppearanceResult; rbi: number; run: boolean }[]
  }[]
}

export type EvaluatedField = 'header' | 'name' | 'result' | 'rbi' | 'run'

export const EVALUATED_FIELDS: readonly EvaluatedField[] = ['header', 'name', 'result', 'rbi', 'run']

/**
 * - correct: right value, high confidence
 * - correctFlagged: right value but marked for review (extra review work)
 * - flagged: wrong or unread value marked for review (caught by review)
 * - silentError: wrong value with high confidence (not caught by review; the most harmful case)
 * - missing: the extraction has no cell for an expected value
 */
export interface FieldCounts {
  expected: number
  correct: number
  correctFlagged: number
  flagged: number
  silentError: number
  missing: number
}

export interface EvaluationReport {
  byField: Record<EvaluatedField, FieldCounts>
  total: FieldCounts
  /** Share of expected values extracted with the right value, regardless of confidence. */
  accuracy: number | null
  extraBatters: number
  extraPlateAppearances: number
  reviewItems: number
}

export class GroundTruthError extends Error {}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringOrNull(value: unknown, path: string): string | null {
  if (value === null || typeof value === 'string') return value
  throw new GroundTruthError(`${path} must be a string or null`)
}

function integer(value: unknown, path: string): number {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value
  throw new GroundTruthError(`${path} must be a non-negative integer`)
}

export function parseGroundTruth(json: unknown): GroundTruth {
  if (!isObject(json) || !Array.isArray(json.batters)) throw new GroundTruthError('batters must be an array')
  return {
    teamName: stringOrNull(json.teamName ?? null, 'teamName'),
    opponentName: stringOrNull(json.opponentName ?? null, 'opponentName'),
    gameDate: stringOrNull(json.gameDate ?? null, 'gameDate'),
    batters: json.batters.map((b: unknown, i) => {
      const path = `batters[${i}]`
      if (!isObject(b) || !Array.isArray(b.plateAppearances)) {
        throw new GroundTruthError(`${path}.plateAppearances must be an array`)
      }
      return {
        battingOrder: integer(b.battingOrder, `${path}.battingOrder`),
        name: stringOrNull(b.name ?? null, `${path}.name`),
        plateAppearances: b.plateAppearances.map((pa: unknown, j) => {
          const paPath = `${path}.plateAppearances[${j}]`
          if (!isObject(pa)) throw new GroundTruthError(`${paPath} must be an object`)
          if (!isPlateAppearanceResult(pa.result)) throw new GroundTruthError(`${paPath}.result is not a known code`)
          if (typeof pa.run !== 'boolean') throw new GroundTruthError(`${paPath}.run must be a boolean`)
          return {
            inning: integer(pa.inning, `${paPath}.inning`),
            result: pa.result,
            rbi: integer(pa.rbi, `${paPath}.rbi`),
            run: pa.run,
          }
        }),
      }
    }),
  }
}

const emptyCounts = (): FieldCounts => ({
  expected: 0,
  correct: 0,
  correctFlagged: 0,
  flagged: 0,
  silentError: 0,
  missing: 0,
})

const normalize = (value: unknown) => (typeof value === 'string' ? value.replace(/\s+/g, '') : value)

function score(counts: FieldCounts, expected: unknown, cell: Cell<unknown> | undefined) {
  counts.expected += 1
  if (!cell) {
    counts.missing += 1
    return
  }
  const right = cell.value !== null && normalize(cell.value) === normalize(expected)
  const confident = cell.confidence === 'high'
  if (right) counts[confident ? 'correct' : 'correctFlagged'] += 1
  else counts[confident ? 'silentError' : 'flagged'] += 1
}

/**
 * Compares an extraction with the ground truth. Batters are matched by batting order and plate
 * appearances by their position after sorting by inning. Names ignore whitespace differences.
 */
export function evaluateExtraction(truth: GroundTruth, record: GameRecord): EvaluationReport {
  const byField = Object.fromEntries(EVALUATED_FIELDS.map((f) => [f, emptyCounts()])) as Record<
    EvaluatedField,
    FieldCounts
  >
  score(byField.header, truth.teamName, record.teamName)
  score(byField.header, truth.opponentName, record.opponentName)
  score(byField.header, truth.gameDate, record.gameDate)

  let extraPlateAppearances = 0
  const matchedBatters = new Set<string>()
  for (const expected of truth.batters) {
    const batter = record.batters.find((b) => b.battingOrder === expected.battingOrder && !matchedBatters.has(b.id))
    if (batter) matchedBatters.add(batter.id)
    score(byField.name, expected.name, batter?.name)
    const actualPas = [...(batter?.plateAppearances ?? [])].sort((a, b) => a.inning - b.inning)
    const expectedPas = [...expected.plateAppearances].sort((a, b) => a.inning - b.inning)
    expectedPas.forEach((pa, i) => {
      const actual = actualPas[i]
      score(byField.result, pa.result, actual?.result)
      score(byField.rbi, pa.rbi, actual?.rbi)
      score(byField.run, pa.run, actual?.run)
    })
    extraPlateAppearances += Math.max(0, actualPas.length - expectedPas.length)
  }

  const total = emptyCounts()
  for (const counts of Object.values(byField)) {
    for (const key of Object.keys(total) as (keyof FieldCounts)[]) total[key] += counts[key]
  }
  return {
    byField,
    total,
    accuracy: total.expected === 0 ? null : (total.correct + total.correctFlagged) / total.expected,
    extraBatters: record.batters.length - matchedBatters.size,
    extraPlateAppearances,
    reviewItems: listReviewItems(record).filter((i) => i.field !== 'name' || i.confidence !== 'high').length,
  }
}
