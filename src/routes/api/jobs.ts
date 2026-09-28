import { createFileRoute } from '@tanstack/react-router'
import { createJob } from '~/server/api'
import { runtimeDeps } from '~/server/runtime'

export const Route = createFileRoute('/api/jobs')({
  server: {
    handlers: {
      POST: ({ request }) => createJob(request, runtimeDeps()),
    },
  },
})
