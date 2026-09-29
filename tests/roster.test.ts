import { describe, expect, it } from 'vitest'
import { createD1RosterStore, createMemoryRosterStore, type D1Like } from '~/server/roster'

function fakeD1(): D1Like & { rows: { id: string; name: string }[] } {
  const rows: { id: string; name: string }[] = []
  return {
    rows,
    async exec() {
      return null
    },
    prepare(sql) {
      return {
        bind: (...values) => ({
          async run() {
            if (sql.startsWith('INSERT')) rows.push({ id: String(values[0]), name: String(values[1]) })
            return null
          },
        }),
        all: async <T,>() => ({ results: rows.map((r) => ({ ...r })) as T[] }),
      }
    },
  }
}

describe.each([
  ['memory', () => createMemoryRosterStore()],
  ['d1', () => createD1RosterStore(fakeD1())],
])('%s roster store', (_, create) => {
  it('registers a name once and finds it again ignoring spacing', async () => {
    const store = create()
    const a = await store.findOrCreate('山田 太郎')
    const b = await store.findOrCreate('山田太郎')
    expect(b.id).toBe(a.id)
    expect(await store.list()).toEqual([{ id: a.id, name: '山田 太郎' }])
  })
})
