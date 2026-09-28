import type { GameRecord } from '../src/features/scoresheet/model'

/** Stand-in extraction result used until real score sheet images are evaluated. */
export const sampleGameRecord: GameRecord = {
  teamName: { value: 'ホークス', confidence: 'high', source: 'extracted' },
  opponentName: { value: 'イーグルス', confidence: 'low', source: 'extracted' },
  gameDate: { value: '2026-09-27', confidence: 'high', source: 'extracted' },
  batters: [
    {
      id: 'b1',
      battingOrder: 1,
      name: { value: '佐藤 大翔', confidence: 'high', source: 'extracted' },
      plateAppearances: [
        { id: 'b1-pa1', inning: 1, result: { value: '1B', confidence: 'high', source: 'extracted' }, rbi: { value: 0, confidence: 'high', source: 'extracted' }, run: { value: true, confidence: 'high', source: 'extracted' } },
        { id: 'b1-pa2', inning: 3, result: { value: 'K', confidence: 'high', source: 'extracted' }, rbi: { value: 0, confidence: 'high', source: 'extracted' }, run: { value: false, confidence: 'high', source: 'extracted' } },
        { id: 'b1-pa3', inning: 5, result: { value: 'BB', confidence: 'high', source: 'extracted' }, rbi: { value: 0, confidence: 'high', source: 'extracted' }, run: { value: true, confidence: 'high', source: 'extracted' } },
      ],
    },
    {
      id: 'b2',
      battingOrder: 2,
      name: { value: '鈴木 蓮', confidence: 'high', source: 'extracted' },
      plateAppearances: [
        { id: 'b2-pa1', inning: 1, result: { value: 'SH', confidence: 'low', source: 'extracted' }, rbi: { value: 0, confidence: 'high', source: 'extracted' }, run: { value: false, confidence: 'high', source: 'extracted' } },
        { id: 'b2-pa2', inning: 3, result: { value: 'OUT', confidence: 'high', source: 'extracted' }, rbi: { value: 0, confidence: 'high', source: 'extracted' }, run: { value: false, confidence: 'high', source: 'extracted' } },
        { id: 'b2-pa3', inning: 5, result: { value: '2B', confidence: 'high', source: 'extracted' }, rbi: { value: 1, confidence: 'high', source: 'extracted' }, run: { value: false, confidence: 'high', source: 'extracted' } },
      ],
    },
    {
      id: 'b3',
      battingOrder: 3,
      name: { value: '高橋 湊', confidence: 'high', source: 'extracted' },
      plateAppearances: [
        { id: 'b3-pa1', inning: 1, result: { value: '2B', confidence: 'high', source: 'extracted' }, rbi: { value: 1, confidence: 'high', source: 'extracted' }, run: { value: true, confidence: 'high', source: 'extracted' } },
        { id: 'b3-pa2', inning: 3, result: { value: '1B', confidence: 'low', source: 'extracted' }, rbi: { value: 0, confidence: 'high', source: 'extracted' }, run: { value: false, confidence: 'high', source: 'extracted' } },
        { id: 'b3-pa3', inning: 6, result: { value: 'OUT', confidence: 'high', source: 'extracted' }, rbi: { value: 0, confidence: 'high', source: 'extracted' }, run: { value: false, confidence: 'high', source: 'extracted' } },
      ],
    },
    {
      id: 'b4',
      battingOrder: 4,
      name: { value: '田中 陽翔', confidence: 'high', source: 'extracted' },
      plateAppearances: [
        { id: 'b4-pa1', inning: 1, result: { value: 'HR', confidence: 'high', source: 'extracted' }, rbi: { value: 2, confidence: 'high', source: 'extracted' }, run: { value: true, confidence: 'high', source: 'extracted' } },
        { id: 'b4-pa2', inning: 4, result: { value: 'K', confidence: 'high', source: 'extracted' }, rbi: { value: 0, confidence: 'high', source: 'extracted' }, run: { value: false, confidence: 'high', source: 'extracted' } },
        { id: 'b4-pa3', inning: 6, result: { value: 'SF', confidence: 'high', source: 'extracted' }, rbi: { value: 1, confidence: 'low', source: 'extracted' }, run: { value: false, confidence: 'high', source: 'extracted' } },
      ],
    },
    {
      id: 'b5',
      battingOrder: 5,
      name: { value: '伊藤 悠真', confidence: 'high', source: 'extracted' },
      plateAppearances: [
        { id: 'b5-pa1', inning: 2, result: { value: 'OUT', confidence: 'high', source: 'extracted' }, rbi: { value: 0, confidence: 'high', source: 'extracted' }, run: { value: false, confidence: 'high', source: 'extracted' } },
        { id: 'b5-pa2', inning: 4, result: { value: '1B', confidence: 'high', source: 'extracted' }, rbi: { value: 0, confidence: 'high', source: 'extracted' }, run: { value: true, confidence: 'high', source: 'extracted' } },
        { id: 'b5-pa3', inning: 6, result: { value: null, confidence: 'unreadable', source: 'extracted' }, rbi: { value: 0, confidence: 'high', source: 'extracted' }, run: { value: false, confidence: 'high', source: 'extracted' } },
      ],
    },
    {
      id: 'b6',
      battingOrder: 6,
      name: { value: '渡辺 蒼', confidence: 'high', source: 'extracted' },
      plateAppearances: [
        { id: 'b6-pa1', inning: 2, result: { value: 'K', confidence: 'high', source: 'extracted' }, rbi: { value: 0, confidence: 'high', source: 'extracted' }, run: { value: false, confidence: 'high', source: 'extracted' } },
        { id: 'b6-pa2', inning: 4, result: { value: '3B', confidence: 'high', source: 'extracted' }, rbi: { value: 1, confidence: 'high', source: 'extracted' }, run: { value: true, confidence: 'high', source: 'extracted' } },
        { id: 'b6-pa3', inning: 6, result: { value: 'OUT', confidence: 'high', source: 'extracted' }, rbi: { value: 0, confidence: 'high', source: 'extracted' }, run: { value: false, confidence: 'high', source: 'extracted' } },
      ],
    },
    {
      id: 'b7',
      battingOrder: 7,
      name: { value: '山本 樹', confidence: 'high', source: 'extracted' },
      plateAppearances: [
        { id: 'b7-pa1', inning: 2, result: { value: 'HBP', confidence: 'high', source: 'extracted' }, rbi: { value: 0, confidence: 'high', source: 'extracted' }, run: { value: false, confidence: 'high', source: 'extracted' } },
        { id: 'b7-pa2', inning: 4, result: { value: 'OUT', confidence: 'high', source: 'extracted' }, rbi: { value: 1, confidence: 'high', source: 'extracted' }, run: { value: null, confidence: 'unreadable', source: 'extracted' } },
      ],
    },
    {
      id: 'b8',
      battingOrder: 8,
      name: { value: '中村 律', confidence: 'high', source: 'extracted' },
      plateAppearances: [
        { id: 'b8-pa1', inning: 3, result: { value: '1B', confidence: 'high', source: 'extracted' }, rbi: { value: 0, confidence: 'high', source: 'extracted' }, run: { value: false, confidence: 'high', source: 'extracted' } },
        { id: 'b8-pa2', inning: 5, result: { value: 'K', confidence: 'high', source: 'extracted' }, rbi: { value: 0, confidence: 'high', source: 'extracted' }, run: { value: false, confidence: 'high', source: 'extracted' } },
      ],
    },
    {
      id: 'b9',
      battingOrder: 9,
      name: { value: '小林 颯', confidence: 'high', source: 'extracted' },
      plateAppearances: [
        { id: 'b9-pa1', inning: 3, result: { value: 'FC', confidence: 'high', source: 'extracted' }, rbi: { value: 0, confidence: 'high', source: 'extracted' }, run: { value: false, confidence: 'high', source: 'extracted' } },
        { id: 'b9-pa2', inning: 5, result: { value: 'OUT', confidence: 'high', source: 'extracted' }, rbi: { value: 0, confidence: 'high', source: 'extracted' }, run: { value: false, confidence: 'high', source: 'extracted' } },
      ],
    },
  ],
}
