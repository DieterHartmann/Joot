import type { FastifyInstance } from 'fastify'
import { db } from '@joot/db'
import { requireRole } from '../plugins/auth.plugin.js'

export default async function orgChartRoutes(app: FastifyInstance) {
  app.get(
    '/api/org-chart',
    { preHandler: [requireRole('holding_admin', 'subsidiary_admin', 'hr_director', 'ceo', 'manager', 'employee')] },
    async (req, reply) => {
      const sessionUser  = req.session!.user as any
      const role         = sessionUser.role         as string
      const subsidiaryId = sessionUser.subsidiaryId as string | undefined

      // ── Holding admin: subsidiaries summary ───────────────────────────────
      if (role === 'holding_admin') {
        const [holding, subs, deptCounts, empCounts] = await Promise.all([
          db.holdingCompany.findFirst(),
          db.subsidiary.findMany({ orderBy: { name: 'asc' } }),
          db.department.groupBy({ by: ['subsidiaryId'], _count: { id: true } }),
          db.user.groupBy({ by: ['subsidiaryId'], _count: { id: true } }),
        ])
        const deptMap = new Map(deptCounts.map(d => [d.subsidiaryId, d._count.id]))
        const empMap  = new Map(empCounts.map(e => [e.subsidiaryId, e._count.id]))
        return reply.send({
          type:        'holding',
          holdingName: holding?.name ?? 'Holding Company',
          userDeptId:  null,
          subsidiaries: subs.map(s => ({
            id:            s.id,
            name:          s.name,
            deptCount:     deptMap.get(s.id) ?? 0,
            employeeCount: empMap.get(s.id)  ?? 0,
          })),
        })
      }

      if (!subsidiaryId) return reply.code(400).send({ error: 'No subsidiary context' })

      // ── Subsidiary roles: full dept tree ──────────────────────────────────
      const [subUser, subsidiary, departments] = await Promise.all([
        db.user.findUnique({
          where:  { email: sessionUser.email },
          select: { departmentId: true },
        }).catch(() => null),
        db.subsidiary.findUnique({ where: { id: subsidiaryId } }),
        db.department.findMany({
          where:   { subsidiaryId },
          include: {
            defaultApprover: { select: { fullName: true } },
            apexApprover:    { select: { fullName: true } },
            _count:          { select: { users: true } },
          },
          orderBy: { treePath: 'asc' },
        }),
      ])

      return reply.send({
        type:           'subsidiary',
        subsidiaryName: subsidiary?.name ?? '',
        userDeptId:     (subUser as any)?.departmentId ?? null,
        departments: departments.map(d => ({
          id:                  d.id,
          name:                d.name,
          parentId:            d.parentDepartmentId,
          defaultApproverName: d.defaultApprover?.fullName ?? null,
          apexApproverName:    d.apexApprover?.fullName    ?? null,
          employeeCount:       d._count.users,
          treeDepth:           d.treeDepth,
        })),
      })
    },
  )
}
