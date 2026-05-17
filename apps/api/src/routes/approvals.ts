import { randomUUID } from 'crypto'
import type { FastifyInstance } from 'fastify'
import { db } from '@joot/db'
import { requireSession } from '../plugins/auth.plugin.js'

async function getSubUser(email: string) {
  return db.user.findUnique({
    where: { email },
    select: { id: true, subsidiaryId: true, role: true },
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

export default async function approvalRoutes(app: FastifyInstance) {
  // ── Pending steps for current user ────────────────────────────────────────
  app.get('/api/approvals', { preHandler: [requireSession] }, async (req, reply) => {
    const me = await getSubUser(req.session!.user.email)
    if (!me) return reply.code(401).send({ error: 'Unauthorized' })

    const steps = await db.approvalStep.findMany({
      where: { approverId: me.id, status: 'pending' },
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
      include: { leaveRequest: true },
    })
    if (!step) return reply.code(404).send({ error: 'Not found' })
    if (step.approverId !== me.id) return reply.code(403).send({ error: 'Forbidden' })
    if (step.status !== 'pending') return reply.code(400).send({ error: `Step already ${step.status}` })

    const { notes } = (req.body ?? {}) as { notes?: string }
    const lr = step.leaveRequest

    // Are there more pending steps after this one?
    const nextStep = await db.approvalStep.findFirst({
      where: { leaveRequestId: lr.id, sequence: { gt: step.sequence }, status: 'pending' },
      orderBy: { sequence: 'asc' },
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

    return reply.send({ status: newRequestStatus })
  })

  // ── Reject ────────────────────────────────────────────────────────────────
  app.post('/api/approvals/:stepId/reject', { preHandler: [requireSession] }, async (req, reply) => {
    const { stepId } = req.params as { stepId: string }
    const me = await getSubUser(req.session!.user.email)
    if (!me) return reply.code(401).send({ error: 'Unauthorized' })

    const step = await db.approvalStep.findUnique({
      where:   { id: stepId },
      include: { leaveRequest: true },
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

    return reply.send({ status: 'rejected' })
  })
}
