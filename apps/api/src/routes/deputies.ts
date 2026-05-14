import type { FastifyInstance } from 'fastify'
import { db, assertNoReciprocalDeputy } from '@joot/db'
import { requireRole } from '../plugins/auth.plugin.js'

export default async function deputyRoutes(app: FastifyInstance) {
  app.get(
    '/api/deputies',
    { preHandler: [requireRole('holding_admin', 'subsidiary_admin', 'hr_director', 'ceo', 'manager')] },
    async (req, reply) => {
      const subsidiaryId = (req.session!.user as any).subsidiaryId as string | undefined
      // Return assignments where the user (the person being covered) is in this subsidiary
      const rows = await db.deputyAssignment.findMany({
        where:   { user: { subsidiaryId } },
        include: { user: true, deputy: true },
        orderBy: { validFrom: 'desc' },
      })
      return reply.send(rows)
    },
  )

  app.post(
    '/api/deputies',
    { preHandler: [requireRole('holding_admin', 'subsidiary_admin', 'hr_director', 'ceo')] },
    async (req, reply) => {
      const body = req.body as {
        userId:              string
        deputyId:            string
        validFrom:           string
        validTo?:            string | null
        isPermanent?:        boolean
        isTemporaryOverride?: boolean
      }

      await assertNoReciprocalDeputy(db, body.userId, body.deputyId)

      const row = await db.deputyAssignment.create({
        data: {
          userId:              body.userId,
          deputyId:            body.deputyId,
          validFrom:           new Date(body.validFrom),
          validTo:             body.validTo ? new Date(body.validTo) : null,
          isPermanent:         body.isPermanent ?? false,
          isTemporaryOverride: body.isTemporaryOverride ?? false,
        },
        include: { user: true, deputy: true },
      })
      return reply.code(201).send(row)
    },
  )

  app.delete(
    '/api/deputies/:id',
    { preHandler: [requireRole('holding_admin', 'subsidiary_admin', 'hr_director', 'ceo')] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      await db.deputyAssignment.delete({ where: { id } })
      return reply.code(204).send()
    },
  )
}
