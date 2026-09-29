import { findPlayer, type Player } from '~/features/scoresheet/roster'

export interface RosterStore {
  list(): Promise<Player[]>
  /** Returns the registered player with the same normalized name, registering a new one if none exists. */
  findOrCreate(name: string): Promise<Player>
}

export function createMemoryRosterStore(initial: Player[] = []): RosterStore {
  const players = [...initial]
  return {
    async list() {
      return players.map((p) => ({ ...p }))
    },
    async findOrCreate(name) {
      const existing = findPlayer(players, name)
      if (existing) return { ...existing }
      const player = { id: crypto.randomUUID(), name }
      players.push(player)
      return { ...player }
    },
  }
}

/** Subset of the Workers D1 binding used here. */
export interface D1Like {
  prepare(sql: string): {
    bind(...values: unknown[]): { run(): Promise<unknown> }
    all<T>(): Promise<{ results: T[] }>
  }
  exec(sql: string): Promise<unknown>
}

const SCHEMA = 'CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL)'

export function createD1RosterStore(db: D1Like): RosterStore {
  let ready: Promise<unknown> | null = null
  const init = () => (ready ??= db.exec(SCHEMA))
  const list = async (): Promise<Player[]> => {
    await init()
    const { results } = await db.prepare('SELECT id, name FROM players ORDER BY created_at').all<Player>()
    return results
  }
  return {
    list,
    async findOrCreate(name) {
      const existing = findPlayer(await list(), name)
      if (existing) return existing
      const player = { id: crypto.randomUUID(), name }
      await db
        .prepare('INSERT INTO players (id, name, created_at) VALUES (?, ?, ?)')
        .bind(player.id, player.name, new Date().toISOString())
        .run()
      return player
    },
  }
}
