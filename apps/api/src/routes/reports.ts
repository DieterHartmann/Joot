import type { FastifyInstance } from 'fastify'
import { db } from '@joot/db'
import { requireRole } from '../plugins/auth.plugin.js'

const PRIVILEGED = ['holding_admin', 'subsidiary_admin', 'hr_director', 'ceo']

// Standard South African working days per year used for daily rate calculation.
const WORKING_DAYS_PER_YEAR = 260

export default async function reportRoutes(app: FastifyInstance) {
  // GET /api/reports/liability?subsidiaryId=&excludeBcea=true
  // Returns leave liability per employee per leave type, with org totals.
  app.get('/api/reports/liability', { preHandler: [requireRole(...PRIVILEGED as [string, ...string[]])] },
    async (req, reply) => {
      const sessionSubId = (req.session!.user as any).subsidiaryId as string | undefined
      const q            = req.query as Record<string, string>
      const subId        = q.subsidiaryId ?? sessionSubId ?? ''
      const excludeBcea  = q.excludeBcea === 'true'

      const balances = await db.leaveBalance.findMany({
        where: {
          user:      { subsidiaryId: subId },
          balance:   { gt: 0 },
          leaveType: excludeBcea ? { bceaProtected: false } : undefined,
        },
        include: {
          user:      { select: { id: true, fullName: true, email: true, ctc: true, departmentId: true } },
          leaveType: { select: { id: true, name: true, category: true, bceaProtected: true } },
        },
        orderBy: [{ user: { fullName: 'asc' } }, { leaveType: { name: 'asc' } }],
      })

      let totalDays     = 0
      let totalMonetary = 0

      const rows = balances.map(b => {
        const ctc       = Number(b.user.ctc)
        const dailyRate = ctc / WORKING_DAYS_PER_YEAR
        const days      = Number(b.balance)
        const monetary  = Math.round(dailyRate * days * 100) / 100

        totalDays     += days
        totalMonetary += monetary

        return {
          userId:       b.user.id,
          fullName:     b.user.fullName,
          email:        b.user.email,
          ctc,
          dailyRate:    Math.round(dailyRate * 100) / 100,
          leaveTypeId:  b.leaveType.id,
          leaveTypeName: b.leaveType.name,
          bceaProtected: b.leaveType.bceaProtected,
          days,
          monetary,
        }
      })

      return reply.send({
        rows,
        summary: {
          totalDays:     Math.round(totalDays * 100) / 100,
          totalMonetary: Math.round(totalMonetary * 100) / 100,
          excludeBcea,
          workingDaysPerYear: WORKING_DAYS_PER_YEAR,
        },
      })
    },
  )

  // GET /api/reports/leave-transactions?month=YYYY-MM&subsidiaryId=
  // Days taken per employee per leave type in a given month — for HR/payslip systems.
  app.get('/api/reports/leave-transactions', { preHandler: [requireRole(...PRIVILEGED as [string, ...string[]])] },
    async (req, reply) => {
      const sessionSubId = (req.session!.user as any).subsidiaryId as string | undefined
      const q            = req.query as Record<string, string>
      const subId        = q.subsidiaryId ?? sessionSubId ?? ''
      const month        = q.month        // YYYY-MM

      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return reply.code(400).send({ error: 'month parameter required (YYYY-MM)' })
      }

      const [year, mon] = month.split('-').map(Number)
      const from = new Date(year, mon - 1, 1)
      const to   = new Date(year, mon,     0) // last day of month

      const requests = await db.leaveRequest.findMany({
        where: {
          user:      { subsidiaryId: subId },
          status:    'approved',
          startDate: { lte: to },
          endDate:   { gte: from },
        },
        include: {
          user:      { select: { id: true, fullName: true, email: true } },
          leaveType: { select: { id: true, name: true, category: true } },
        },
        orderBy: [{ user: { fullName: 'asc' } }, { startDate: 'asc' }],
      })

      const rows = requests.map(r => ({
        employeeId:    r.user.id,
        fullName:      r.user.fullName,
        email:         r.user.email,
        leaveTypeId:   r.leaveType.id,
        leaveTypeName: r.leaveType.name,
        category:      r.leaveType.category,
        startDate:     r.startDate.toISOString().slice(0, 10),
        endDate:       r.endDate.toISOString().slice(0, 10),
        days:          Number(r.daysCalculated),
        leaveRequestId: r.id,
      }))

      return reply.send({ month, rows, total: rows.reduce((s, r) => s + r.days, 0) })
    },
  )
}
