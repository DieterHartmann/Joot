import type { FastifyInstance } from 'fastify'
import { db } from '@joot/db'
import { requireRole } from '../plugins/auth.plugin.js'

export default async function auditRoutes(app: FastifyInstance) {
  app.get(
    '/api/audit',
    { preHandler: [requireRole('holding_admin', 'subsidiary_admin', 'hr_director', 'ceo')] },
    async (req, reply) => {
      const { entityId, entityType, limit = '100', offset = '0' } =
        req.query as Record<string, string>

      const rows = await db.auditEvent.findMany({
        where: {
          entityId:   entityId   || undefined,
          entityType: entityType || undefined,
        },
        include: { actor: true },
        orderBy: { createdAt: 'desc' },
        take:    Math.min(parseInt(limit, 10), 500),
        skip:    parseInt(offset, 10),
      })

      return reply.send(rows)
    },
  )
}
