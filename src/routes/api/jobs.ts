import { createFileRoute } from '@tanstack/react-router'
import { createJob, defaultDeps } from '~/server/api'

export const Route = createFileRoute('/api/jobs')({
  server: {
    handlers: {
      POST: ({ request }) => createJob(request, defaultDeps),
    },
  },
})
