import type { FastifyInstance } from 'fastify'
import { requireSession } from '../plugins/auth.plugin.js'

// Phase 4: approval step decision handling, BullMQ notification dispatch
export default async function approvalRoutes(app: FastifyInstance) {
  // Pending approval steps assigned to the current user
  app.get(
    '/api/approvals',
    { preHandler: [requireSession] },
    async (_req, reply) => reply.code(501).send({ error: 'Not implemented' }),
  )

  app.post(
    '/api/approvals/:stepId/approve',
    { preHandler: [requireSession] },
    async (_req, reply) => reply.code(501).send({ error: 'Not implemented' }),
  )

  app.post(
    '/api/approvals/:stepId/reject',
    { preHandler: [requireSession] },
    async (_req, reply) => reply.code(501).send({ error: 'Not implemented' }),
  )
}
