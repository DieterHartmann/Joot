import type { FastifyInstance } from 'fastify'
import { db } from '@joot/db'
import { requireSession } from '../plugins/auth.plugin.js'

export default async function meRoutes(app: FastifyInstance) {
  app.get('/api/me', { preHandler: [requireSession] }, async (req, reply) => {
    const { user } = req.session!
    const subsidiaryId = (user as any).subsidiaryId as string | undefined

    if (!subsidiaryId) {
      // Holding admin or unassigned user — return auth profile only
      return reply.send({ authUser: user, subsidiaryUser: null })
    }

    const subsidiaryUser = await db.user.findUnique({
      where:   { email: user.email },
      include: { department: true },
    })

    return reply.send({ authUser: user, subsidiaryUser })
  })
}
