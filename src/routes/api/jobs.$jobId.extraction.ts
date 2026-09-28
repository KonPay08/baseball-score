import { createFileRoute } from '@tanstack/react-router'
import { defaultDeps, getExtraction } from '~/server/api'

export const Route = createFileRoute('/api/jobs/$jobId/extraction')({
  server: {
    handlers: {
      GET: ({ params }) => getExtraction(params.jobId, defaultDeps),
    },
  },
})
