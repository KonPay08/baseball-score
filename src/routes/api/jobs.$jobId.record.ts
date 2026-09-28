import { createFileRoute } from '@tanstack/react-router'
import { correctRecord } from '~/server/api'
import { runtimeDeps } from '~/server/runtime'

export const Route = createFileRoute('/api/jobs/$jobId/record')({
  server: {
    handlers: {
      PATCH: ({ params, request }) => correctRecord(params.jobId, request, runtimeDeps()),
    },
  },
})
