import { randomUUID } from 'crypto'
import type { FastifyInstance } from 'fastify'
import { db } from '@joot/db'
import { requireSession } from '../plugins/auth.plugin.js'
import { queue } from '../queue.js'

async function getSubUser(email: string) {
  return db.user.findUnique({
    where:  { email },
    select: { id: true, fullName: true, subsidiaryId: true, role: true },
  })
}

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

export default async function approvalRoutes(app: FastifyInstance) {
  // ── Pending steps for current user ────────────────────────────────────────
  app.get('/api/approvals', { preHandler: [requireSession] }, async (req, reply) => {
    const me = await getSubUser(req.session!.user.email)
    if (!me) return reply.code(401).send({ error: 'Unauthorized' })

    const steps = await db.approvalStep.findMany({
      where:   { approverId: me.id, status: 'pending' },
      include: {
        leaveRequest: {
          include: {
            user:      { select: { id: true, fullName: true, email: true } },
            leaveType: { select: { id: true, name: true, category: true } },
          },
        },
      },
      orderBy: { leaveRequest: { createdAt: 'asc' } },
    })

    return reply.send(steps)
  })

  // ── Approve ───────────────────────────────────────────────────────────────
  app.post('/api/approvals/:stepId/approve', { preHandler: [requireSession] }, async (req, reply) => {
    const { stepId } = req.params as { stepId: string }
    const me = await getSubUser(req.session!.user.email)
    if (!me) return reply.code(401).send({ error: 'Unauthorized' })

    const step = await db.approvalStep.findUnique({
      where:   { id: stepId },
      include: {
        leaveRequest: {
          include: {
            user:      { select: { id: true, fullName: true, email: true } },
            leaveType: { select: { id: true, name: true } },
          },
        },
      },
    })
    if (!step) return reply.code(404).send({ error: 'Not found' })
    if (step.approverId !== me.id) return reply.code(403).send({ error: 'Forbidden' })
    if (step.status !== 'pending') return reply.code(400).send({ error: `Step already ${step.status}` })

    const { notes } = (req.body ?? {}) as { notes?: string }
    const lr = step.leaveRequest

    // Check for a next pending step
    const nextStep = await db.approvalStep.findFirst({
      where:   { leaveRequestId: lr.id, sequence: { gt: step.sequence }, status: 'pending' },
      orderBy: { sequence: 'asc' },
      include: { approver: { select: { email: true, fullName: true } } },
    })

    const newRequestStatus = nextStep ? 'pending_apex' : 'approved'

    await db.$transaction(async (tx) => {
      await tx.approvalStep.update({
        where: { id: stepId },
        data:  { status: 'approved', decisionNotes: notes, decidedAt: new Date() },
      })
      await tx.leaveRequest.update({
        where: { id: lr.id },
        data:  { status: newRequestStatus as any },
      })
      if (newRequestStatus === 'approved') {
        await adjustBalance(tx, lr.userId, lr.leaveTypeId, Number(lr.daysCalculated))
        await tx.auditEvent.create({
          data: {
            id: randomUUID(), entityId: lr.id,
            entityType: 'leave_request', eventType: 'approved',
            actorId: me.id,
            beforeState: { status: lr.status },
            afterState:  { status: 'approved' },
          },
        })
      }
    })

    if (queue) {
      const base = {
        leaveTypeName: lr.leaveType.name,
        startDate:     lr.startDate.toISOString(),
        endDate:       lr.endDate.toISOString(),
        days:          Number(lr.daysCalculated),
        appUrl:        appUrl(),
      }

      if (newRequestStatus === 'approved') {
        // Notify employee
        await queue.add('notify-employee', {
          type: 'notify-employee',
          payload: {
            ...base,
            leaveRequestId: lr.id,
            employeeEmail:  lr.user.email,
            employeeName:   lr.user.fullName,
            status:         'approved',
            approverName:   me.fullName ?? req.session!.user.name,
            decisionNotes:  notes,
          },
        })
      } else if (nextStep) {
        // Notify next approver (apex step)
        await queue.add('notify-approver', {
          type: 'notify-approver',
          payload: {
            ...base,
            leaveRequestId: lr.id,
            stepId:         nextStep.id,
            stepSequence:   nextStep.sequence,
            approverEmail:  nextStep.approver.email,
            approverName:   nextStep.approver.fullName,
            employeeName:   lr.user.fullName,
            appUrl:         appUrl(),
          },
        })
      }
    }

    return reply.send({ status: newRequestStatus })
  })

  // ── Reject ────────────────────────────────────────────────────────────────
  app.post('/api/approvals/:stepId/reject', { preHandler: [requireSession] }, async (req, reply) => {
    const { stepId } = req.params as { stepId: string }
    const me = await getSubUser(req.session!.user.email)
    if (!me) return reply.code(401).send({ error: 'Unauthorized' })

    const step = await db.approvalStep.findUnique({
      where:   { id: stepId },
      include: {
        leaveRequest: {
          include: {
            user:      { select: { id: true, fullName: true, email: true } },
            leaveType: { select: { id: true, name: true } },
          },
        },
      },
    })
    if (!step) return reply.code(404).send({ error: 'Not found' })
    if (step.approverId !== me.id) return reply.code(403).send({ error: 'Forbidden' })
    if (step.status !== 'pending') return reply.code(400).send({ error: `Step already ${step.status}` })

    const { notes } = (req.body ?? {}) as { notes?: string }
    const lr = step.leaveRequest

    await db.$transaction(async (tx) => {
      await tx.approvalStep.update({
        where: { id: stepId },
        data:  { status: 'rejected', decisionNotes: notes, decidedAt: new Date() },
      })
      await tx.leaveRequest.update({
        where: { id: lr.id },
        data:  { status: 'rejected' },
      })
      await tx.auditEvent.create({
        data: {
          id: randomUUID(), entityId: lr.id,
          entityType: 'leave_request', eventType: 'rejected',
          actorId: me.id,
          beforeState: { status: lr.status },
          afterState:  { status: 'rejected', notes },
        },
      })
    })

    if (queue) {
      await queue.add('notify-employee', {
        type: 'notify-employee',
        payload: {
          leaveRequestId: lr.id,
          employeeEmail:  lr.user.email,
          employeeName:   lr.user.fullName,
          leaveTypeName:  lr.leaveType.name,
          startDate:      lr.startDate.toISOString(),
          endDate:        lr.endDate.toISOString(),
          days:           Number(lr.daysCalculated),
          status:         'rejected',
          approverName:   me.fullName ?? req.session!.user.name,
          decisionNotes:  notes,
          appUrl:         appUrl(),
        },
      })
    }

    return reply.send({ status: 'rejected' })
  })
}
