import type { FastifyInstance } from 'fastify'
import { requireSession } from '../plugins/auth.plugin.js'
import { queue } from '../queue.js'

const PRIVILEGED = ['hr_director', 'ceo', 'subsidiary_admin', 'holding_admin']

export default async function accrualRoutes(app: FastifyInstance) {
  app.post('/api/accrual/run', { preHandler: [requireSession] }, async (req, reply) => {
    const role = (req.session!.user as any).role
    if (!PRIVILEGED.includes(role)) return reply.code(403).send({ error: 'Forbidden' })

    if (!queue) return reply.code(503).send({ error: 'Queue not available' })

    await queue.add('run-accrual-manual', {
      type:    'run-accrual',
      payload: { triggeredBy: 'manual' },
    })

    return reply.code(202).send({ message: 'Accrual job enqueued' })
  })
}
