import { createFileRoute } from '@tanstack/react-router'
import { getExtraction } from '~/server/api'
import { runtimeDeps } from '~/server/runtime'

export const Route = createFileRoute('/api/jobs/$jobId/extraction')({
  server: {
    handlers: {
      GET: ({ params }) => getExtraction(params.jobId, runtimeDeps()),
    },
  },
})
