import type { FastifyInstance } from 'fastify'
import { db } from '@joot/db'
import { requireRole, requireSession } from '../plugins/auth.plugin.js'

export default async function subsidiaryRoutes(app: FastifyInstance) {
  app.get(
    '/api/holding-company',
    { preHandler: [requireSession] },
    async (_req, reply) => {
      const row = await db.holdingCompany.findFirst()
      return row ? reply.send(row) : reply.code(404).send({ error: 'Not found' })
    },
  )

  app.get(
    '/api/subsidiaries',
    { preHandler: [requireRole('holding_admin')] },
    async (_req, reply) => {
      const rows = await db.subsidiary.findMany({
        include:  { holdingCompany: true },
        orderBy:  { name: 'asc' },
      })
      return reply.send(rows)
    },
  )

  app.get(
    '/api/subsidiaries/:id',
    { preHandler: [requireRole('holding_admin', 'subsidiary_admin', 'hr_director', 'ceo')] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const row = await db.subsidiary.findUnique({
        where:   { id },
        include: { holdingCompany: true },
      })
      return row ? reply.send(row) : reply.code(404).send({ error: 'Not found' })
    },
  )

  app.post(
    '/api/subsidiaries',
    { preHandler: [requireRole('holding_admin')] },
    async (req, reply) => {
      const body = req.body as {
        holdingCompanyId:       string
        name:                   string
        pgSchema:               string
        leaveYearType:          'calendar' | 'tax' | 'anniversary'
        leaveYearStart?:        string
        publicHolidaysExcluded?: boolean
        timezone?:              string
        countryCode?:           string
      }
      const row = await db.subsidiary.create({
        data: {
          holdingCompanyId:       body.holdingCompanyId,
          name:                   body.name,
          pgSchema:               body.pgSchema,
          leaveYearType:          body.leaveYearType,
          leaveYearStart:         body.leaveYearStart ? new Date(body.leaveYearStart) : undefined,
          publicHolidaysExcluded: body.publicHolidaysExcluded ?? true,
          timezone:               body.timezone ?? 'Africa/Johannesburg',
          countryCode:            body.countryCode ?? 'ZA',
        },
      })
      return reply.code(201).send(row)
    },
  )

  app.patch(
    '/api/subsidiaries/:id',
    { preHandler: [requireRole('holding_admin')] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const body = req.body as {
        name?:                   string
        leaveYearType?:          'calendar' | 'tax' | 'anniversary'
        leaveYearStart?:         string | null
        publicHolidaysExcluded?: boolean
        timezone?:               string
        countryCode?:            string
      }
      const row = await db.subsidiary.update({
        where: { id },
        data: {
          name:                   body.name,
          leaveYearType:          body.leaveYearType,
          leaveYearStart:         body.leaveYearStart ? new Date(body.leaveYearStart) : body.leaveYearStart === null ? null : undefined,
          publicHolidaysExcluded: body.publicHolidaysExcluded,
          timezone:               body.timezone,
          countryCode:            body.countryCode,
        },
      })
      return reply.send(row)
    },
  )
}
