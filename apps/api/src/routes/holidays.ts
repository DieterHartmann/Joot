import type { FastifyInstance } from 'fastify'
import { db } from '@joot/db'
import { requireRole } from '../plugins/auth.plugin.js'
import { providers } from '../providers/holidays.js'

export default async function holidayRoutes(app: FastifyInstance) {
  // List holidays for a subsidiary, optionally filtered by year
  app.get(
    '/api/holidays',
    { preHandler: [requireRole('holding_admin', 'subsidiary_admin', 'hr_director', 'ceo', 'manager', 'employee')] },
    async (req, reply) => {
      const { year, subsidiaryId: qSub } = req.query as { year?: string; subsidiaryId?: string }
      const sessionSubId = (req.session!.user as any).subsidiaryId as string | null
      const subsidiaryId = qSub ?? sessionSubId
      if (!subsidiaryId) return reply.code(400).send({ error: 'subsidiaryId required' })

      const where: any = { subsidiaryId }
      if (year) {
        const y = parseInt(year, 10)
        where.holidayDate = {
          gte: new Date(`${y}-01-01`),
          lte: new Date(`${y}-12-31`),
        }
      }

      const rows = await db.publicHolidayCalendar.findMany({ where, orderBy: { holidayDate: 'asc' } })
      return reply.send(rows)
    },
  )

  // Manually add a holiday
  app.post(
    '/api/holidays',
    { preHandler: [requireRole('holding_admin', 'subsidiary_admin', 'hr_director')] },
    async (req, reply) => {
      const body = req.body as { name: string; holidayDate: string; description?: string; subsidiaryId?: string }
      const sessionSubId = (req.session!.user as any).subsidiaryId as string | null
      const subsidiaryId = body.subsidiaryId ?? sessionSubId
      if (!subsidiaryId) return reply.code(400).send({ error: 'subsidiaryId required' })

      const sub = await db.subsidiary.findUnique({ where: { id: subsidiaryId } })
      if (!sub) return reply.code(400).send({ error: 'Subsidiary not found' })

      const row = await db.publicHolidayCalendar.create({
        data: {
          subsidiaryId,
          name:        body.name,
          holidayDate: new Date(body.holidayDate),
          description: body.description,
          source:      'manual',
          countryCode: sub.countryCode,
        },
      })
      return reply.code(201).send(row)
    },
  )

  // Delete a holiday (any source)
  app.delete(
    '/api/holidays/:id',
    { preHandler: [requireRole('holding_admin', 'subsidiary_admin', 'hr_director')] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      await db.publicHolidayCalendar.delete({ where: { id } })
      return reply.code(204).send()
    },
  )

  // Sync from external provider for a given year
  app.post(
    '/api/holidays/sync',
    { preHandler: [requireRole('holding_admin', 'subsidiary_admin', 'hr_director')] },
    async (req, reply) => {
      const body = req.body as { year: number; provider?: string; subsidiaryId?: string }
      const sessionSubId = (req.session!.user as any).subsidiaryId as string | null
      const subsidiaryId = body.subsidiaryId ?? sessionSubId
      if (!subsidiaryId) return reply.code(400).send({ error: 'subsidiaryId required' })

      const sub = await db.subsidiary.findUnique({ where: { id: subsidiaryId } })
      if (!sub) return reply.code(400).send({ error: 'Subsidiary not found' })

      const providerId = body.provider ?? 'nager_date'
      const provider   = providers[providerId]
      if (!provider) return reply.code(400).send({ error: `Unknown provider "${providerId}"` })

      const entries = await provider.fetch(sub.countryCode, body.year)

      let added   = 0
      let updated = 0
      let skipped = 0

      for (const entry of entries) {
        const existing = await db.publicHolidayCalendar.findUnique({
          where: { subsidiaryId_holidayDate: { subsidiaryId, holidayDate: entry.date } },
        })

        if (!existing) {
          await db.publicHolidayCalendar.create({
            data: {
              subsidiaryId,
              name:        entry.name,
              holidayDate: entry.date,
              description: entry.description,
              source:      provider.id,
              countryCode: entry.countryCode,
            },
          })
          added++
        } else if (existing.source === 'manual') {
          skipped++ // never overwrite manual entries
        } else {
          await db.publicHolidayCalendar.update({
            where: { id: existing.id },
            data:  { name: entry.name, description: entry.description },
          })
          updated++
        }
      }

      return reply.send({ added, updated, skipped, total: entries.length })
    },
  )
}
