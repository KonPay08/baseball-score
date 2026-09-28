import { describe, expect, it } from 'vitest'
import { evaluateExtraction, GroundTruthError, parseGroundTruth } from '~/features/scoresheet/evaluation'
import type { Cell, GameRecord } from '~/features/scoresheet/model'

const c = <T>(value: T | null, confidence: Cell<T>['confidence'] = 'high'): Cell<T> => ({
  value,
  confidence,
  source: 'extracted',
})

const truth = parseGroundTruth({
  teamName: 'ホークス',
  opponentName: 'イーグルス',
  gameDate: '2026-09-27',
  batters: [
    {
      battingOrder: 1,
      name: '佐藤 大翔',
      plateAppearances: [
        { inning: 1, result: '1B', rbi: 0, run: true },
        { inning: 3, result: 'K', rbi: 0, run: false },
      ],
    },
    { battingOrder: 2, name: '鈴木', plateAppearances: [{ inning: 1, result: 'BB', rbi: 0, run: false }] },
  ],
})

const record: GameRecord = {
  teamName: c('ホークス'),
  opponentName: c('イーグルス', 'low'),
  gameDate: c<string>(null, 'unreadable'),
  batters: [
    {
      id: 'b1',
      battingOrder: 1,
      name: c('佐藤大翔'),
      plateAppearances: [
        { id: 'p2', inning: 3, result: c('OUT'), rbi: c(0), run: c(false) },
        { id: 'p1', inning: 1, result: c('1B'), rbi: c(0), run: c(true) },
        { id: 'p3', inning: 5, result: c('K'), rbi: c(0), run: c(false) },
      ],
    },
    { id: 'b9', battingOrder: 9, name: c('余分'), plateAppearances: [] },
  ],
}

describe('evaluateExtraction', () => {
  const report = evaluateExtraction(truth, record)

  it('classifies each expected value', () => {
    expect(report.byField.header).toMatchObject({ expected: 3, correct: 1, correctFlagged: 1, flagged: 1 })
    expect(report.byField.name).toMatchObject({ expected: 2, correct: 1, missing: 1 })
    expect(report.byField.result).toMatchObject({ expected: 3, correct: 1, silentError: 1, missing: 1 })
    expect(report.byField.run).toMatchObject({ expected: 3, correct: 2, missing: 1 })
  })

  it('reports totals, extras and review load', () => {
    expect(report.total.expected).toBe(14)
    expect(report.accuracy).toBeCloseTo(8 / 14)
    expect(report.extraBatters).toBe(1)
    expect(report.extraPlateAppearances).toBe(1)
    expect(report.reviewItems).toBe(0)
  })
})

describe('parseGroundTruth', () => {
  it('rejects unknown result codes with the path', () => {
    expect(() =>
      parseGroundTruth({
        batters: [{ battingOrder: 1, name: 'a', plateAppearances: [{ inning: 1, result: 'X', rbi: 0, run: false }] }],
      }),
    ).toThrow(new GroundTruthError('batters[0].plateAppearances[0].result is not a known code'))
  })
})
