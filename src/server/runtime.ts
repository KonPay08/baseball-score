import { env } from 'cloudflare:workers'
import type { ApiDeps } from './api'
import { selectExtractor } from './extractorConfig'
import { createMemoryJobStore } from './jobs'

const store = createMemoryJobStore()

/** Dependencies for the deployed Worker / dev server. The extractor is chosen per request from `env`. */
export function runtimeDeps(): ApiDeps {
  return { store, extractor: selectExtractor(env) }
}
