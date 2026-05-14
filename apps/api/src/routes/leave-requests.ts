import type { FastifyInstance } from 'fastify'
import { requireSession } from '../plugins/auth.plugin.js'

// Phase 4: leave request submission, approval chain resolution, BullMQ events
export default async function leaveRequestRoutes(app: FastifyInstance) {
  app.get(
    '/api/leave-requests',
    { preHandler: [requireSession] },
    async (_req, reply) => reply.code(501).send({ error: 'Not implemented' }),
  )

  app.get(
    '/api/leave-requests/:id',
    { preHandler: [requireSession] },
    async (_req, reply) => reply.code(501).send({ error: 'Not implemented' }),
  )

  app.post(
    '/api/leave-requests',
    { preHandler: [requireSession] },
    async (_req, reply) => reply.code(501).send({ error: 'Not implemented' }),
  )

  // Cancel a draft request
  app.delete(
    '/api/leave-requests/:id',
    { preHandler: [requireSession] },
    async (_req, reply) => reply.code(501).send({ error: 'Not implemented' }),
  )

  // Recall an approved request (apex / HR Director only)
  app.post(
    '/api/leave-requests/:id/recall',
    { preHandler: [requireSession] },
    async (_req, reply) => reply.code(501).send({ error: 'Not implemented' }),
  )
}
