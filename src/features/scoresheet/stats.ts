import { isResolved, type GameRecord, type PlateAppearanceResult } from './model'

export interface BattingStats {
  batterId: string
  battingOrder: number
  name: string | null
  plateAppearances: number
  atBats: number
  hits: number
  doubles: number
  triples: number
  homeRuns: number
  runsBattedIn: number
  runs: number
  walks: number
  hitByPitch: number
  strikeouts: number
  sacrificeBunts: number
  sacrificeFlies: number
  /** null when atBats is 0 or the batter has unresolved cells. */
  battingAverage: number | null
  /** Number of cells for this batter that still need review; stats are provisional while > 0. */
  unresolvedCells: number
  complete: boolean
}

const HITS: readonly PlateAppearanceResult[] = ['1B', '2B', '3B', 'HR']
const NOT_AT_BAT: readonly PlateAppearanceResult[] = ['BB', 'HBP', 'SH', 'SF', 'INT']

export function calculateBattingStats(record: GameRecord): BattingStats[] {
  return record.batters.map((batter) => {
    const stats: BattingStats = {
      batterId: batter.id,
      battingOrder: batter.battingOrder,
      name: batter.name.value,
      plateAppearances: 0,
      atBats: 0,
      hits: 0,
      doubles: 0,
      triples: 0,
      homeRuns: 0,
      runsBattedIn: 0,
      runs: 0,
      walks: 0,
      hitByPitch: 0,
      strikeouts: 0,
      sacrificeBunts: 0,
      sacrificeFlies: 0,
      battingAverage: null,
      unresolvedCells: 0,
      complete: false,
    }

    for (const pa of batter.plateAppearances) {
      const result = pa.result.value
      if (result !== null && isResolved(pa.result)) {
        stats.plateAppearances += 1
        if (!NOT_AT_BAT.includes(result)) stats.atBats += 1
        if (HITS.includes(result)) stats.hits += 1
        if (result === '2B') stats.doubles += 1
        if (result === '3B') stats.triples += 1
        if (result === 'HR') stats.homeRuns += 1
        if (result === 'BB') stats.walks += 1
        if (result === 'HBP') stats.hitByPitch += 1
        if (result === 'K') stats.strikeouts += 1
        if (result === 'SH') stats.sacrificeBunts += 1
        if (result === 'SF') stats.sacrificeFlies += 1
      } else {
        stats.unresolvedCells += 1
      }
      if (pa.rbi.value !== null && isResolved(pa.rbi)) stats.runsBattedIn += pa.rbi.value
      else stats.unresolvedCells += 1
      if (pa.run.value !== null && isResolved(pa.run)) stats.runs += pa.run.value ? 1 : 0
      else stats.unresolvedCells += 1
    }

    stats.complete = stats.unresolvedCells === 0
    stats.battingAverage =
      stats.complete && stats.atBats > 0 ? stats.hits / stats.atBats : null
    return stats
  })
}

export function formatAverage(value: number | null): string {
  if (value === null) return '-'
  return value.toFixed(3).replace(/^0/, '')
}
