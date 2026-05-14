import type { FastifyInstance } from 'fastify'
import { db } from '@joot/db'
import { requireRole } from '../plugins/auth.plugin.js'

export default async function holidayRoutes(app: FastifyInstance) {
  app.get(
    '/api/holidays',
    { preHandler: [requireRole('holding_admin', 'subsidiary_admin', 'hr_director', 'ceo', 'manager', 'employee')] },
    async (req, reply) => {
      const subsidiaryId = (req.session!.user as any).subsidiaryId as string | undefined
      const rows = await db.publicHolidayCalendar.findMany({
        where:   { subsidiaryId },
        orderBy: { holidayDate: 'asc' },
      })
      return reply.send(rows)
    },
  )

  app.post(
    '/api/holidays',
    { preHandler: [requireRole('holding_admin', 'subsidiary_admin', 'hr_director')] },
    async (req, reply) => {
      const body = req.body as {
        subsidiaryId: string
        name:         string
        holidayDate:  string
        description?: string
      }
      const row = await db.publicHolidayCalendar.create({
        data: {
          subsidiaryId: body.subsidiaryId,
          name:         body.name,
          holidayDate:  new Date(body.holidayDate),
          description:  body.description,
        },
      })
      return reply.code(201).send(row)
    },
  )

  app.delete(
    '/api/holidays/:id',
    { preHandler: [requireRole('holding_admin', 'subsidiary_admin', 'hr_director')] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      await db.publicHolidayCalendar.delete({ where: { id } })
      return reply.code(204).send()
    },
  )
}
