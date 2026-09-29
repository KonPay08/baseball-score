import type { Batter, GameRecord } from './model'

export interface Player {
  id: string
  name: string
}

/** Width, case and whitespace differences are ignored when comparing names. */
export function normalizeName(name: string): string {
  return name.normalize('NFKC').replace(/\s+/g, '').toLowerCase()
}

export function findPlayer(players: readonly Player[], name: string | null): Player | undefined {
  if (!name) return undefined
  const key = normalizeName(name)
  return key ? players.find((p) => normalizeName(p.name) === key) : undefined
}

/** Adopts the roster spelling for every batter whose extracted name matches a registered player. */
export function matchRoster(record: GameRecord, players: readonly Player[]): GameRecord {
  const next = structuredClone(record)
  for (const batter of next.batters) {
    const player = findPlayer(players, batter.name.value)
    if (!player) continue
    batter.playerId = player.id
    batter.name = { value: player.name, confidence: 'high', source: batter.name.source }
  }
  return next
}

/** 1-based position of the batter among players sharing the same batting order (substitutes come later). */
export function slotInBattingOrder(batters: readonly Batter[], batter: Batter): number {
  return batters.filter((b) => b.battingOrder === batter.battingOrder).indexOf(batter) + 1
}
