import type { FastifyInstance } from 'fastify'
import { db, syncTreePath } from '@joot/db'
import { requireRole } from '../plugins/auth.plugin.js'

export default async function departmentRoutes(app: FastifyInstance) {
  app.get(
    '/api/departments',
    { preHandler: [requireRole('holding_admin', 'subsidiary_admin', 'hr_director', 'ceo', 'manager')] },
    async (req, reply) => {
      const subsidiaryId = (req.session!.user as any).subsidiaryId as string | undefined
      const role         = (req.session!.user as any).role         as string | undefined
      const rows = await db.department.findMany({
        where:   role === 'holding_admin' ? undefined : { subsidiaryId },
        orderBy: { treePath: 'asc' },
      })
      return reply.send(rows)
    },
  )

  app.get(
    '/api/departments/:id',
    { preHandler: [requireRole('holding_admin', 'subsidiary_admin', 'hr_director', 'ceo', 'manager')] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const row = await db.department.findUnique({
        where:   { id },
        include: { children: true, defaultApprover: true, apexApprover: true },
      })
      return row ? reply.send(row) : reply.code(404).send({ error: 'Not found' })
    },
  )

  app.post(
    '/api/departments',
    { preHandler: [requireRole('holding_admin', 'subsidiary_admin', 'hr_director')] },
    async (req, reply) => {
      const body = req.body as {
        subsidiaryId:       string
        parentDepartmentId?: string
        name:               string
        defaultApproverId:  string
        apexApproverId?:    string
      }

      // Compute tree path from parent (or root if no parent)
      let treePath      = ''
      let treePathLabel = ''
      let treeDepth     = 0

      if (body.parentDepartmentId) {
        const parent = await db.department.findUniqueOrThrow({
          where: { id: body.parentDepartmentId },
        })
        treePath      = `${parent.treePath}.`
        treePathLabel = `${parent.treePathLabel}.`
        treeDepth     = parent.treeDepth + 1
      }

      // Temporary placeholder — syncTreePath will rebuild after we have the real UUID.
      // We need the department ID first (generated on create) before we can write
      // the final treePath that includes the new node's own UUID segment.
      const dept = await db.department.create({
        data: {
          subsidiaryId:       body.subsidiaryId,
          parentDepartmentId: body.parentDepartmentId,
          name:               body.name,
          defaultApproverId:  body.defaultApproverId,
          apexApproverId:     body.apexApproverId,
          treeDepth,
          treePath:           `${treePath}PLACEHOLDER`,
          treePathLabel:      `${treePathLabel}${body.name}`,
        },
      })

      // Now rebuild treePath properly — includes the node's own UUID
      await syncTreePath(db, dept.id)

      const final = await db.department.findUniqueOrThrow({ where: { id: dept.id } })
      return reply.code(201).send(final)
    },
  )

  app.patch(
    '/api/departments/:id',
    { preHandler: [requireRole('holding_admin', 'subsidiary_admin', 'hr_director')] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const body = req.body as {
        name?:               string
        parentDepartmentId?: string | null
        defaultApproverId?:  string
        apexApproverId?:     string | null
      }

      await db.department.update({
        where: { id },
        data: {
          name:               body.name,
          defaultApproverId:  body.defaultApproverId,
          apexApproverId:     body.apexApproverId,
          parentDepartmentId: body.parentDepartmentId,
        },
      })

      // Name or parent changed → rebuild tree paths for this node and all descendants
      if (body.name !== undefined || body.parentDepartmentId !== undefined) {
        await syncTreePath(db, id)
      }

      const final = await db.department.findUniqueOrThrow({ where: { id } })
      return reply.send(final)
    },
  )
}
