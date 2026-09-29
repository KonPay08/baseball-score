import { describe, expect, it } from 'vitest'
import type { Batter, Cell, GameRecord, PlateAppearanceResult } from '~/features/scoresheet/model'
import { applyCorrections, CorrectionError, listReviewItems } from '~/features/scoresheet/review'
import { matchRoster } from '~/features/scoresheet/roster'
import { calculateBattingStats, formatAverage } from '~/features/scoresheet/stats'
import { sampleGameRecord } from '../fixtures/sample-game-record'

const high = <T>(value: T): Cell<T> => ({ value, confidence: 'high', source: 'extracted' })

function batter(results: PlateAppearanceResult[], overrides: Partial<Batter> = {}): Batter {
  return {
    id: 'b1',
    battingOrder: 1,
    name: high('テスト'),
    plateAppearances: results.map((r, i) => ({
      id: `pa${i}`,
      inning: i + 1,
      result: high(r),
      rbi: high(0),
      run: high(false),
    })),
    ...overrides,
  }
}

function game(batters: Batter[]): GameRecord {
  return { teamName: high('A'), opponentName: high('B'), gameDate: high('2026-09-27'), batters }
}

describe('calculateBattingStats', () => {
  it('excludes walks, HBP, sacrifices and interference from at-bats', () => {
    const [s] = calculateBattingStats(game([batter(['1B', 'BB', 'HBP', 'SH', 'SF', 'INT', 'K'])]))
    expect(s.plateAppearances).toBe(7)
    expect(s.atBats).toBe(2)
    expect(s.hits).toBe(1)
    expect(s.battingAverage).toBe(0.5)
    expect(s.complete).toBe(true)
  })

  it('counts errors and fielder choices as at-bats without hits', () => {
    const [s] = calculateBattingStats(game([batter(['E', 'FC', 'HR'])]))
    expect(s.atBats).toBe(3)
    expect(s.hits).toBe(1)
    expect(s.homeRuns).toBe(1)
    expect(formatAverage(s.battingAverage)).toBe('.333')
  })

  it('returns null average when there are no at-bats', () => {
    const [s] = calculateBattingStats(game([batter(['BB', 'SH'])]))
    expect(s.battingAverage).toBeNull()
    expect(formatAverage(s.battingAverage)).toBe('-')
  })

  it('does not treat unreadable or low-confidence cells as zero', () => {
    const b = batter(['1B', 'OUT'])
    b.plateAppearances[1].result = { value: null, confidence: 'unreadable', source: 'extracted' }
    b.plateAppearances[0].rbi = { value: 1, confidence: 'low', source: 'extracted' }
    const [s] = calculateBattingStats(game([b]))
    expect(s.plateAppearances).toBe(1)
    expect(s.runsBattedIn).toBe(0)
    expect(s.unresolvedCells).toBe(2)
    expect(s.complete).toBe(false)
    expect(s.battingAverage).toBeNull()
  })
})

const roster = sampleGameRecord.batters.map((b) => ({ id: `p-${b.id}`, name: b.name.value ?? '' }))
const matched = matchRoster(sampleGameRecord, roster)

describe('review and corrections', () => {
  it('lists every unresolved cell in the sample record', () => {
    const items = listReviewItems(matched)
    expect(items.map((i) => `${i.plateAppearanceId}:${i.field}`).sort()).toEqual(
      ['b2-pa1:result', 'b3-pa2:result', 'b4-pa3:rbi', 'b5-pa3:result', 'b7-pa2:run'].sort(),
    )
  })

  it('applies corrections without mutating the input and resolves stats', () => {
    const corrected = applyCorrections(matched, [
      { plateAppearanceId: 'b2-pa1', field: 'result', value: 'SH' },
      { plateAppearanceId: 'b3-pa2', field: 'result', value: '1B' },
      { plateAppearanceId: 'b4-pa3', field: 'rbi', value: 1 },
      { plateAppearanceId: 'b5-pa3', field: 'result', value: 'OUT' },
      { plateAppearanceId: 'b7-pa2', field: 'run', value: false },
    ])
    expect(listReviewItems(matched)).toHaveLength(5)
    expect(listReviewItems(corrected)).toHaveLength(0)
    const stats = calculateBattingStats(corrected)
    expect(stats.every((s) => s.complete)).toBe(true)
    const cleanup = stats.find((s) => s.batterId === 'b4')
    expect(cleanup).toMatchObject({ atBats: 2, hits: 1, homeRuns: 1, runsBattedIn: 3, sacrificeFlies: 1 })
    expect(cleanup?.battingAverage).toBe(0.5)
  })

  it('rejects invalid corrections atomically', () => {
    expect(() =>
      applyCorrections(sampleGameRecord, [
        { plateAppearanceId: 'b2-pa1', field: 'result', value: 'SH' },
        { plateAppearanceId: 'b4-pa3', field: 'rbi', value: 5 },
      ]),
    ).toThrow(CorrectionError)
    expect(() =>
      applyCorrections(sampleGameRecord, [{ plateAppearanceId: 'nope', field: 'run', value: true }]),
    ).toThrow(/unknown plateAppearanceId/)
  })
})

describe('player names', () => {
  it('asks for every name that is not matched to the roster, labelling substitutes by slot', () => {
    const record: GameRecord = {
      ...sampleGameRecord,
      batters: [
        batter([], { id: 'a', battingOrder: 4, name: high('田中') }),
        batter([], { id: 'b', battingOrder: 4, name: high('たなか') }),
      ],
    }
    const items = listReviewItems(matchRoster(record, [{ id: 'p1', name: '田中' }]))
    expect(items).toEqual([
      expect.objectContaining({ batterId: 'b', field: 'name', plateAppearanceId: null, battingOrder: 4, slot: 2 }),
    ])
  })

  it('matches names ignoring width and spaces and adopts the roster spelling', () => {
    const record: GameRecord = { ...sampleGameRecord, batters: [batter([], { name: high('佐藤　大翔') })] }
    const [b] = matchRoster(record, [{ id: 'p1', name: '佐藤大翔' }]).batters
    expect(b).toMatchObject({ playerId: 'p1', name: { value: '佐藤大翔', confidence: 'high' } })
  })

  it('corrects a name and clears the previous match', () => {
    const next = applyCorrections(matched, [{ batterId: 'b1', field: 'name', value: '  山田 太郎 ' }])
    expect(next.batters[0]).toMatchObject({ name: { value: '山田 太郎', source: 'corrected' } })
    expect(next.batters[0].playerId).toBeUndefined()
    expect(() => applyCorrections(matched, [{ batterId: 'b1', field: 'name', value: ' ' }])).toThrow(CorrectionError)
    expect(() => applyCorrections(matched, [{ batterId: 'x', field: 'name', value: 'a' }])).toThrow(/unknown batterId/)
  })
})
