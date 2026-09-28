import { createFileRoute } from '@tanstack/react-router'
import { getJob } from '~/server/api'
import { runtimeDeps } from '~/server/runtime'

export const Route = createFileRoute('/api/jobs/$jobId')({
  server: {
    handlers: {
      GET: ({ params }) => getJob(params.jobId, runtimeDeps()),
    },
  },
})
