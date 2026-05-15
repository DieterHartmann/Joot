import { randomUUID } from 'crypto'
import type { FastifyInstance } from 'fastify'
import { db } from '@joot/db'
import { auth } from '../auth.js'
import { requireRole } from '../plugins/auth.plugin.js'

export default async function userRoutes(app: FastifyInstance) {
  // List users — scoped to requester's subsidiary (holding_admin sees all)
  app.get(
    '/api/users',
    { preHandler: [requireRole('holding_admin', 'subsidiary_admin', 'hr_director', 'ceo', 'manager')] },
    async (req, reply) => {
      const subsidiaryId = (req.session!.user as any).subsidiaryId as string | undefined
      const role         = (req.session!.user as any).role         as string | undefined
      const rows = await db.user.findMany({
        where:   role === 'holding_admin' ? undefined : { subsidiaryId },
        include: { department: true },
        orderBy: { fullName: 'asc' },
      })
      return reply.send(rows)
    },
  )

  app.get(
    '/api/users/:id',
    { preHandler: [requireRole('holding_admin', 'subsidiary_admin', 'hr_director', 'ceo', 'manager')] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const row = await db.user.findUnique({
        where:   { id },
        include: {
          department:    true,
          leaveBalances: { include: { leaveType: true } },
        },
      })
      return row ? reply.send(row) : reply.code(404).send({ error: 'Not found' })
    },
  )

  // Admin-initiated user creation:
  //   1. Create Better Auth credential user (handles password hashing)
  //   2. Update BaUser with our additional fields (subsidiaryId, role)
  //   3. Create the subsidiary User record with the same UUID
  app.post(
    '/api/users',
    { preHandler: [requireRole('holding_admin', 'subsidiary_admin', 'hr_director')] },
    async (req, reply) => {
      const body = req.body as {
        email:         string
        fullName:      string
        password:      string
        subsidiaryId:  string
        departmentId:  string
        role:          string
        startDate:     string
        ctc:           number
      }

      // Create the auth user via Better Auth's server-side signup.
      // asResponse: false returns { user, session } directly (no HTTP round-trip).
      const authResult = await auth.api.signUpEmail({
        body: {
          email:    body.email,
          name:     body.fullName,
          password: body.password,
        },
        headers: new Headers(),
      })

      // Patch the BaUser row with our application-level additional fields.
      // We bypass the Better Auth API here because signUpEmail doesn't surface
      // additionalFields in its server-side call signature in 1.2.x.
      await (db as any).baUser.update({
        where: { id: authResult.user.id },
        data:  { subsidiaryId: body.subsidiaryId, role: body.role },
      })

      const subsidiaryUser = await db.user.create({
        data: {
          id:           randomUUID(),
          email:        body.email,
          fullName:     body.fullName,
          subsidiaryId: body.subsidiaryId,
          departmentId: body.departmentId,
          role:         body.role as any,
          startDate:    new Date(body.startDate),
          ctc:          body.ctc,
        },
      })

      return reply.code(201).send({ user: subsidiaryUser })
    },
  )

  app.patch(
    '/api/users/:id',
    { preHandler: [requireRole('holding_admin', 'subsidiary_admin', 'hr_director')] },
    async (req, reply) => {
      const { id }   = req.params as { id: string }
      const body = req.body as {
        fullName?:    string
        departmentId?: string
        role?:        string
        ctc?:         number
      }
      const row = await db.user.update({
        where: { id },
        data: {
          fullName:     body.fullName,
          departmentId: body.departmentId,
          role:         body.role as any,
          ctc:          body.ctc,
        },
      })
      return reply.send(row)
    },
  )
}
