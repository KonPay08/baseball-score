import { createFileRoute } from '@tanstack/react-router'
import { defaultDeps, getJob } from '~/server/api'

export const Route = createFileRoute('/api/jobs/$jobId')({
  server: {
    handlers: {
      GET: ({ params }) => getJob(params.jobId, defaultDeps),
    },
  },
})
