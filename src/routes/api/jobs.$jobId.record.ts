import { createFileRoute } from '@tanstack/react-router'
import { correctRecord, defaultDeps } from '~/server/api'

export const Route = createFileRoute('/api/jobs/$jobId/record')({
  server: {
    handlers: {
      PATCH: ({ params, request }) => correctRecord(params.jobId, request, defaultDeps),
    },
  },
})
