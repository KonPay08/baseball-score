import { env } from 'cloudflare:workers'
import type { ApiDeps } from './api'
import { selectExtractor } from './extractorConfig'
import { createMemoryJobStore } from './jobs'
import { createD1RosterStore, createMemoryRosterStore, type RosterStore } from './roster'

const store = createMemoryJobStore()
let roster: RosterStore | null = null

/** Dependencies for the deployed Worker / dev server. The extractor is chosen per request from `env`. */
export function runtimeDeps(): ApiDeps {
  roster ??= env.DB ? createD1RosterStore(env.DB) : createMemoryRosterStore()
  return { store, extractor: selectExtractor(env), roster }
}
