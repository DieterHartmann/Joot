import type { FastifyInstance } from 'fastify'
import { db } from '@joot/db'
import { requireRole, requireSession } from '../plugins/auth.plugin.js'

export default async function leaveBalanceRoutes(app: FastifyInstance) {
  // Own balances
  app.get(
    '/api/leave-balances/me',
    { preHandler: [requireSession] },
    async (req, reply) => {
      const userId = req.session!.user.id
      const rows = await db.leaveBalance.findMany({
        where:   { userId },
        include: { leaveType: true },
        orderBy: { leaveType: { name: 'asc' } },
      })
      return reply.send(rows)
    },
  )

  // Any user's balances (HR Director and above)
  app.get(
    '/api/leave-balances/:userId',
    { preHandler: [requireRole('holding_admin', 'subsidiary_admin', 'hr_director', 'ceo', 'manager')] },
    async (req, reply) => {
      const { userId } = req.params as { userId: string }
      const rows = await db.leaveBalance.findMany({
        where:   { userId },
        include: { leaveType: true },
        orderBy: { leaveType: { name: 'asc' } },
      })
      return reply.send(rows)
    },
  )

  // Manual balance adjustment (HR Director only) — Phase 4 will add audit event
  app.post(
    '/api/leave-balances/:userId/adjust',
    { preHandler: [requireRole('hr_director', 'ceo', 'holding_admin')] },
    async (_req, reply) => reply.code(501).send({ error: 'Not implemented' }),
  )
}
