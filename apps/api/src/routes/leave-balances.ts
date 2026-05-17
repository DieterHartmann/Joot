import type { FastifyInstance } from 'fastify'
import { db } from '@joot/db'
import { requireSession } from '../plugins/auth.plugin.js'

// Returns a full balance picture: every active leave type for the user's
// subsidiary, with their current balance merged in (zero-filled if no record).
async function buildBalances(subsidiaryId: string, userId: string) {
  const [leaveTypes, existing] = await Promise.all([
    db.leaveType.findMany({
      where:   { subsidiaryId, active: true },
      orderBy: { name: 'asc' },
    }),
    db.leaveBalance.findMany({
      where: { userId },
    }),
  ])

  const map = new Map(existing.map(b => [b.leaveTypeId, b]))

  return leaveTypes.map(lt => {
    const b = map.get(lt.id)
    return {
      leaveType:       lt,
      accrued:         b ? Number(b.accrued)     : 0,
      used:            b ? Number(b.used)         : 0,
      balance:         b ? Number(b.balance)      : 0,
      accrualRate:     b ? Number(b.accrualRate)  : 0,
      lastAccrualDate: b?.lastAccrualDate ?? null,
      expiryDate:      b?.expiryDate      ?? null,
    }
  })
}

export default async function leaveBalanceRoutes(app: FastifyInstance) {
  // ── Own balances ──────────────────────────────────────────────────────────
  app.get('/api/leave-balances/me', { preHandler: [requireSession] }, async (req, reply) => {
    const subUser = await db.user.findUnique({
      where:  { email: req.session!.user.email },
      select: { id: true, subsidiaryId: true },
    })
    if (!subUser) return reply.code(404).send({ error: 'User not found' })

    return reply.send(await buildBalances(subUser.subsidiaryId, subUser.id))
  })

  // ── Any user's balances (manager and above) ───────────────────────────────
  app.get('/api/leave-balances/:userId', { preHandler: [requireSession] }, async (req, reply) => {
    const me = await db.user.findUnique({
      where:  { email: req.session!.user.email },
      select: { role: true, subsidiaryId: true },
    })
    if (!me) return reply.code(401).send({ error: 'Unauthorized' })

    const allowed = ['holding_admin', 'subsidiary_admin', 'hr_director', 'ceo', 'manager']
    if (!allowed.includes(me.role)) return reply.code(403).send({ error: 'Forbidden' })

    const { userId } = req.params as { userId: string }
    const target = await db.user.findUnique({
      where:  { id: userId },
      select: { id: true, subsidiaryId: true },
    })
    if (!target) return reply.code(404).send({ error: 'User not found' })

    return reply.send(await buildBalances(target.subsidiaryId, target.id))
  })

  // ── Manual adjustment (HR Director / admin) ───────────────────────────────
  app.post('/api/leave-balances/:userId/adjust', { preHandler: [requireSession] }, async (req, reply) => {
    const me = await db.user.findUnique({
      where:  { email: req.session!.user.email },
      select: { id: true, role: true },
    })
    if (!me) return reply.code(401).send({ error: 'Unauthorized' })

    const allowed = ['holding_admin', 'subsidiary_admin', 'hr_director']
    if (!allowed.includes(me.role)) return reply.code(403).send({ error: 'Forbidden' })

    const { userId } = req.params as { userId: string }
    const body = req.body as { leaveTypeId: string; delta: number; reason: string }

    if (!body.leaveTypeId || body.delta === undefined || !body.reason) {
      return reply.code(400).send({ error: 'leaveTypeId, delta and reason are required' })
    }

    const { randomUUID } = await import('crypto')

    await db.$transaction(async (tx) => {
      await (tx.leaveBalance as any).upsert({
        where:  { userId_leaveTypeId: { userId, leaveTypeId: body.leaveTypeId } },
        update: { accrued: { increment: body.delta }, balance: { increment: body.delta } },
        create: {
          id: randomUUID(), userId, leaveTypeId: body.leaveTypeId,
          accrued: body.delta, used: 0, balance: body.delta,
          accrualRate: 0, lastAccrualDate: new Date(),
        },
      })

      await tx.auditEvent.create({
        data: {
          id: randomUUID(), entityId: userId,
          entityType: 'leave_balance', eventType: 'manual_adjustment',
          actorId: me.id,
          afterState: { leaveTypeId: body.leaveTypeId, delta: body.delta, reason: body.reason },
        },
      })
    })

    return reply.send({ ok: true })
  })
}
