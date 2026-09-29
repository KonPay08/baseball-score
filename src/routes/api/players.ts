import { createFileRoute } from '@tanstack/react-router'
import { listPlayers } from '~/server/api'
import { runtimeDeps } from '~/server/runtime'

export const Route = createFileRoute('/api/players')({
  server: {
    handlers: {
      GET: () => listPlayers(runtimeDeps()),
    },
  },
})
