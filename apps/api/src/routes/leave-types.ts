import type { FastifyInstance } from 'fastify'
import { db } from '@joot/db'
import { requireRole } from '../plugins/auth.plugin.js'

const BCEA_FLOORS: Record<string, number> = {
  annual:                15,
  sick:                  30, // per 3-year cycle
  family_responsibility:  3,
}

export default async function leaveTypeRoutes(app: FastifyInstance) {
  app.get(
    '/api/leave-types',
    { preHandler: [requireRole('holding_admin', 'subsidiary_admin', 'hr_director', 'ceo', 'manager', 'employee')] },
    async (req, reply) => {
      const subsidiaryId = (req.session!.user as any).subsidiaryId as string | undefined
      const rows = await db.leaveType.findMany({
        where:   { subsidiaryId },
        include: { rules: true },
        orderBy: { name: 'asc' },
      })
      return reply.send(rows)
    },
  )

  app.get(
    '/api/leave-types/:id',
    { preHandler: [requireRole('holding_admin', 'subsidiary_admin', 'hr_director', 'ceo', 'manager', 'employee')] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const row = await db.leaveType.findUnique({
        where:   { id },
        include: { rules: true },
      })
      return row ? reply.send(row) : reply.code(404).send({ error: 'Not found' })
    },
  )

  app.post(
    '/api/leave-types',
    { preHandler: [requireRole('holding_admin', 'subsidiary_admin', 'hr_director')] },
    async (req, reply) => {
      const body = req.body as {
        subsidiaryId:          string
        name:                  string
        category:              string
        maxDaysPerYear?:       number | null
        allowNegative?:        boolean
        expiryMonths?:         number | null
        requiresDualApproval?: boolean
        bceaProtected?:        boolean
        active?:               boolean
      }

      if (body.bceaProtected && body.category in BCEA_FLOORS) {
        const floor = BCEA_FLOORS[body.category]!
        if (body.maxDaysPerYear !== undefined && body.maxDaysPerYear !== null && body.maxDaysPerYear < floor) {
          return reply.code(422).send({
            error: `BCEA floor violation: ${body.category} must be at least ${floor} days`,
          })
        }
      }

      const row = await db.leaveType.create({
        data: {
          subsidiaryId:          body.subsidiaryId,
          name:                  body.name,
          category:              body.category as any,
          maxDaysPerYear:        body.maxDaysPerYear,
          allowNegative:         body.allowNegative  ?? false,
          expiryMonths:          body.expiryMonths,
          requiresDualApproval:  body.requiresDualApproval ?? false,
          bceaProtected:         body.bceaProtected ?? false,
          active:                body.active ?? true,
        },
      })
      return reply.code(201).send(row)
    },
  )

  app.patch(
    '/api/leave-types/:id',
    { preHandler: [requireRole('holding_admin', 'subsidiary_admin', 'hr_director')] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const body = req.body as {
        name?:                  string
        maxDaysPerYear?:        number | null
        allowNegative?:         boolean
        expiryMonths?:          number | null
        requiresDualApproval?:  boolean
        bceaProtected?:         boolean
        active?:                boolean
      }

      const existing = await db.leaveType.findUniqueOrThrow({ where: { id } })
      const bceaProtected = body.bceaProtected ?? existing.bceaProtected
      const category      = existing.category
      const maxDays       = body.maxDaysPerYear !== undefined ? body.maxDaysPerYear : existing.maxDaysPerYear

      if (bceaProtected && category in BCEA_FLOORS) {
        const floor = BCEA_FLOORS[category]!
        if (maxDays !== null && maxDays !== undefined && maxDays < floor) {
          return reply.code(422).send({
            error: `BCEA floor violation: ${category} must be at least ${floor} days`,
          })
        }
      }

      const row = await db.leaveType.update({
        where: { id },
        data: {
          name:                  body.name,
          maxDaysPerYear:        body.maxDaysPerYear,
          allowNegative:         body.allowNegative,
          expiryMonths:          body.expiryMonths,
          requiresDualApproval:  body.requiresDualApproval,
          bceaProtected:         body.bceaProtected,
          active:                body.active,
        },
      })
      return reply.send(row)
    },
  )
}
