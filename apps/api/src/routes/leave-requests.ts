import { randomUUID } from 'crypto'
import type { FastifyInstance } from 'fastify'
import { db, resolveApexApprover, resolveDeputy } from '@joot/db'
import { requireSession } from '../plugins/auth.plugin.js'
import { queue } from '../queue.js'

// Count Mon–Fri days between two dates (inclusive).
function workingDays(start: Date, end: Date): number {
  let count = 0
  const cur = new Date(start)
  cur.setHours(0, 0, 0, 0)
  const fin = new Date(end)
  fin.setHours(0, 0, 0, 0)
  while (cur <= fin) {
    const d = cur.getDay()
    if (d !== 0 && d !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

async function getSubUser(email: string) {
  return db.user.findUnique({
    where:  { email },
    select: { id: true, fullName: true, subsidiaryId: true, departmentId: true, role: true },
  })
}

// delta > 0 = deduct (used++, balance--); delta < 0 = restore (used--, balance++)
async function adjustBalance(tx: any, userId: string, leaveTypeId: string, delta: number) {
  await tx.leaveBalance.upsert({
    where:  { userId_leaveTypeId: { userId, leaveTypeId } },
    update: { used: { increment: delta }, balance: { decrement: delta } },
    create: {
      id: randomUUID(), userId, leaveTypeId,
      accrued: 0, used: delta, balance: -delta,
      accrualRate: 0, lastAccrualDate: new Date(),
    },
  })
}

const appUrl = () => process.env.APP_URL ?? process.env.BETTER_AUTH_URL ?? 'http://localhost:4000'

const PRIVILEGED = ['hr_director', 'ceo', 'subsidiary_admin', 'holding_admin']

export default async function leaveRequestRoutes(app: FastifyInstance) {
  // ── List ──────────────────────────────────────────────────────────────────
  app.get('/api/leave-requests', { preHandler: [requireSession] }, async (req, reply) => {
    const me = await getSubUser(req.session!.user.email)
    if (!me) return reply.code(401).send({ error: 'Unauthorized' })

    const include = {
      user:          { select: { id: true, fullName: true, email: true } },
      leaveType:     { select: { id: true, name: true, category: true } },
      approvalSteps: {
        include: { approver: { select: { id: true, fullName: true } } },
        orderBy: { sequence: 'asc' as const },
      },
    }

    if (PRIVILEGED.includes(me.role)) {
      const rows = await db.leaveRequest.findMany({
        where:   { user: { subsidiaryId: me.subsidiaryId } },
        include,
        orderBy: { createdAt: 'desc' },
      })
      return reply.send(rows)
    }

    const rows = await db.leaveRequest.findMany({
      where: {
        OR: [
          { userId: me.id },
          { approvalSteps: { some: { approverId: me.id } } },
        ],
      },
      include,
      orderBy: { createdAt: 'desc' },
    })
    return reply.send(rows)
  })

  // ── Single ────────────────────────────────────────────────────────────────
  app.get('/api/leave-requests/:id', { preHandler: [requireSession] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const me = await getSubUser(req.session!.user.email)
    if (!me) return reply.code(401).send({ error: 'Unauthorized' })

    const row = await db.leaveRequest.findUnique({
      where:   { id },
      include: {
        user:          { select: { id: true, fullName: true, email: true } },
        leaveType:     true,
        approvalSteps: {
          include: { approver: { select: { id: true, fullName: true } } },
          orderBy: { sequence: 'asc' },
        },
      },
    })
    if (!row) return reply.code(404).send({ error: 'Not found' })

    const canSee = PRIVILEGED.includes(me.role)
      || row.userId === me.id
      || row.approvalSteps.some(s => s.approverId === me.id)
    if (!canSee) return reply.code(403).send({ error: 'Forbidden' })

    return reply.send(row)
  })

  // ── Submit ────────────────────────────────────────────────────────────────
  app.post('/api/leave-requests', { preHandler: [requireSession] }, async (req, reply) => {
    const me = await getSubUser(req.session!.user.email)
    if (!me) return reply.code(401).send({ error: 'Unauthorized' })

    const body = req.body as {
      leaveTypeId:      string
      startDate:        string
      endDate:          string
      notes?:           string
      includesHalfDay?: boolean
      halfDayPortion?:  'morning' | 'afternoon'
    }

    const leaveType = await db.leaveType.findUnique({ where: { id: body.leaveTypeId } })
    if (!leaveType?.active) return reply.code(400).send({ error: 'Invalid or inactive leave type' })

    const start = new Date(body.startDate)
    const end   = new Date(body.endDate)
    if (end < start) return reply.code(400).send({ error: 'End date must not precede start date' })

    let days = workingDays(start, end)
    if (body.includesHalfDay) days -= 0.5
    if (days <= 0) return reply.code(400).send({ error: 'No working days in selected range' })

    // Balance check
    if (!leaveType.allowNegative) {
      const bal = await db.leaveBalance.findUnique({
        where:  { userId_leaveTypeId: { userId: me.id, leaveTypeId: leaveType.id } },
        select: { balance: true },
      })
      const avail = bal ? Number(bal.balance) : 0
      if (avail < days) {
        return reply.code(400).send({ error: `Insufficient balance — available: ${avail}, requested: ${days}` })
      }
    }

    // Build approval chain
    const steps: { approverId: string; sequence: number }[] = []

    if (me.departmentId) {
      const dept = await db.department.findUnique({
        where:  { id: me.departmentId },
        select: { defaultApproverId: true },
      })
      if (dept?.defaultApproverId) {
        const lineManagerId = await resolveDeputy(db as any, dept.defaultApproverId)
        steps.push({ approverId: lineManagerId, sequence: 1 })
      }
      if (leaveType.requiresDualApproval) {
        const apexId = await resolveApexApprover(db as any, me.departmentId, me.subsidiaryId)
        steps.push({ approverId: apexId, sequence: steps.length + 1 })
      }
    }

    // Look up step-1 approver details for the notification (before transaction)
    const step1Approver = steps.length > 0
      ? await db.user.findUnique({
          where:  { id: steps[0].approverId },
          select: { email: true, fullName: true },
        })
      : null

    const requestId    = randomUUID()
    const autoApproved = steps.length === 0
    const status       = autoApproved ? 'approved' : 'pending_line_manager'
    const today        = new Date(); today.setHours(0, 0, 0, 0)
    const isBackdated  = start < today

    const lr = await db.$transaction(async (tx) => {
      const created = await tx.leaveRequest.create({
        data: {
          id: requestId,
          userId:          me.id,
          leaveTypeId:     leaveType.id,
          startDate:       start,
          endDate:         end,
          daysCalculated:  days,
          includesHalfDay: body.includesHalfDay ?? false,
          halfDayPortion:  body.halfDayPortion as any ?? null,
          status:          status as any,
          notes:           body.notes,
          isBackdated,
        },
      })

      if (steps.length > 0) {
        await tx.approvalStep.createMany({
          data: steps.map(s => ({
            id: randomUUID(),
            leaveRequestId: requestId,
            approverId:     s.approverId,
            sequence:       s.sequence,
            status:         'pending' as const,
          })),
        })
      } else {
        await adjustBalance(tx, me.id, leaveType.id, days)
        await tx.auditEvent.create({
          data: {
            id: randomUUID(), entityId: requestId,
            entityType: 'leave_request', eventType: 'auto_approved',
            actorId: me.id, afterState: { status: 'approved', days },
          },
        })
      }

      return created
    })

    // Enqueue notification after successful commit
    if (step1Approver && queue) {
      await queue.add('notify-approver', {
        type: 'notify-approver',
        payload: {
          leaveRequestId: requestId,
          stepId:         '', // not needed for notification routing
          stepSequence:   1,
          approverEmail:  step1Approver.email,
          approverName:   step1Approver.fullName,
          employeeName:   me.fullName ?? req.session!.user.name,
          leaveTypeName:  leaveType.name,
          startDate:      body.startDate,
          endDate:        body.endDate,
          days,
          notes:          body.notes,
          appUrl:         appUrl(),
        },
      })
    }

    return reply.code(201).send(lr)
  })

  // ── Cancel (draft / pending) ───────────────────────────────────────────────
  app.delete('/api/leave-requests/:id', { preHandler: [requireSession] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const me = await getSubUser(req.session!.user.email)
    if (!me) return reply.code(401).send({ error: 'Unauthorized' })

    const row = await db.leaveRequest.findUnique({ where: { id } })
    if (!row) return reply.code(404).send({ error: 'Not found' })
    if (row.userId !== me.id && !PRIVILEGED.includes(me.role)) return reply.code(403).send({ error: 'Forbidden' })
    if (!['draft', 'pending_line_manager', 'pending_apex'].includes(row.status)) {
      return reply.code(400).send({ error: `Cannot cancel a ${row.status} request` })
    }

    await db.leaveRequest.update({ where: { id }, data: { status: 'cancelled' } })
    return reply.code(204).send()
  })

  // ── Recall (approved) ─────────────────────────────────────────────────────
  app.post('/api/leave-requests/:id/recall', { preHandler: [requireSession] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const me = await getSubUser(req.session!.user.email)
    if (!me) return reply.code(401).send({ error: 'Unauthorized' })

    const row = await db.leaveRequest.findUnique({
      where:   { id },
      include: {
        user:      { select: { email: true, fullName: true } },
        leaveType: { select: { name: true } },
      },
    })
    if (!row) return reply.code(404).send({ error: 'Not found' })
    if (row.status !== 'approved') return reply.code(400).send({ error: 'Only approved requests can be recalled' })

    const canRecall = row.userId === me.id || PRIVILEGED.includes(me.role)
    if (!canRecall) return reply.code(403).send({ error: 'Forbidden' })

    const { notes } = (req.body ?? {}) as { notes?: string }
    const days = Number(row.daysCalculated)

    await db.$transaction(async (tx) => {
      await tx.leaveRequest.update({ where: { id }, data: { status: 'recalled' } })
      await adjustBalance(tx, row.userId, row.leaveTypeId, -days)
      await tx.auditEvent.create({
        data: {
          id: randomUUID(), entityId: id,
          entityType: 'leave_request', eventType: 'recalled',
          actorId: me.id,
          beforeState: { status: 'approved' },
          afterState:  { status: 'recalled', notes },
        },
      })
    })

    if (queue) {
      await queue.add('notify-recall', {
        type: 'notify-recall',
        payload: {
          leaveRequestId:  id,
          employeeEmail:   row.user.email,
          employeeName:    row.user.fullName,
          leaveTypeName:   row.leaveType.name,
          startDate:       row.startDate.toISOString(),
          endDate:         row.endDate.toISOString(),
          days,
          recalledByName:  me.fullName ?? req.session!.user.name,
          notes,
          appUrl:          appUrl(),
        },
      })
    }

    return reply.code(204).send()
  })
}
