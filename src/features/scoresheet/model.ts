export const PLATE_APPEARANCE_RESULTS = [
  '1B',
  '2B',
  '3B',
  'HR',
  'BB',
  'HBP',
  'K',
  'OUT',
  'SH',
  'SF',
  'E',
  'FC',
  'INT',
] as const

export type PlateAppearanceResult = (typeof PLATE_APPEARANCE_RESULTS)[number]

export const RESULT_LABELS: Record<PlateAppearanceResult, string> = {
  '1B': '単打',
  '2B': '二塁打',
  '3B': '三塁打',
  HR: '本塁打',
  BB: '四球',
  HBP: '死球',
  K: '三振',
  OUT: '凡打',
  SH: '犠打',
  SF: '犠飛',
  E: '失策出塁',
  FC: '野選',
  INT: '打撃妨害',
}

export type Confidence = 'high' | 'low' | 'unreadable'

/**
 * One cell read from the score sheet. `value` is null when the cell could not be read;
 * a null value is never treated as zero by the stats calculation.
 */
export interface Cell<T> {
  value: T | null
  confidence: Confidence
  source: 'extracted' | 'corrected'
}

export interface PlateAppearance {
  id: string
  inning: number
  result: Cell<PlateAppearanceResult>
  rbi: Cell<number>
  run: Cell<boolean>
}

export interface Batter {
  id: string
  battingOrder: number
  name: Cell<string>
  /** Roster player the name was matched to. Unset until matched or entered by the user. */
  playerId?: string
  plateAppearances: PlateAppearance[]
}

export interface GameRecord {
  teamName: Cell<string>
  opponentName: Cell<string>
  gameDate: Cell<string>
  batters: Batter[]
}

export type CellField = 'result' | 'rbi' | 'run'
export type ReviewField = CellField | 'name'

export function isResolved<T>(cell: Cell<T>): boolean {
  return cell.value !== null && (cell.confidence === 'high' || cell.source === 'corrected')
}

export function isPlateAppearanceResult(value: unknown): value is PlateAppearanceResult {
  return typeof value === 'string' && (PLATE_APPEARANCE_RESULTS as readonly string[]).includes(value)
}
