import { randomUUID } from 'crypto'
import type { Job, JobData, NotifyApproverPayload, NotifyEmployeePayload, NotifyRecallPayload, RunAccrualPayload, WarnExpiryPayload } from '@joot/queue'
import { db } from '@joot/db'
import { sendMail } from './mailer.js'
import { notifyApproverHtml, notifyEmployeeHtml, notifyRecallHtml, warnExpiryHtml } from './templates.js'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}

async function handleNotifyApprover(p: NotifyApproverPayload) {
  const subject = `Leave approval required — ${p.employeeName}`
  const text = [
    `Hi ${p.approverName},`,
    '',
    `${p.employeeName} has submitted a leave request and requires your approval (Step ${p.stepSequence}).`,
    '',
    `Leave type : ${p.leaveTypeName}`,
    `From       : ${fmtDate(p.startDate)}`,
    `To         : ${fmtDate(p.endDate)}`,
    `Days       : ${p.days}`,
    p.notes ? `Notes      : ${p.notes}` : null,
    '',
    `Please log in to review the request:`,
    `${p.appUrl}/approvals`,
    '',
    '— Joot Leave Management',
  ].filter(l => l !== null).join('\n')

  await sendMail({ to: p.approverEmail, subject, text, html: notifyApproverHtml(p) })
}

async function handleNotifyEmployee(p: NotifyEmployeePayload) {
  const verb    = p.status === 'approved' ? 'approved' : 'rejected'
  const subject = `Your leave request has been ${verb}`
  const text = [
    `Hi ${p.employeeName},`,
    '',
    `Your leave request has been ${verb} by ${p.approverName}.`,
    '',
    `Leave type : ${p.leaveTypeName}`,
    `From       : ${fmtDate(p.startDate)}`,
    `To         : ${fmtDate(p.endDate)}`,
    `Days       : ${p.days}`,
    p.decisionNotes ? `Notes      : ${p.decisionNotes}` : null,
    '',
    `View your leave history:`,
    `${p.appUrl}/leave-requests`,
    '',
    '— Joot Leave Management',
  ].filter(l => l !== null).join('\n')

  await sendMail({ to: p.employeeEmail, subject, text, html: notifyEmployeeHtml(p) })
}

async function handleNotifyRecall(p: NotifyRecallPayload) {
  const subject = `Your approved leave has been recalled`
  const text = [
    `Hi ${p.employeeName},`,
    '',
    `Your approved leave has been recalled by ${p.recalledByName}. The days have been restored to your balance.`,
    '',
    `Leave type : ${p.leaveTypeName}`,
    `From       : ${fmtDate(p.startDate)}`,
    `To         : ${fmtDate(p.endDate)}`,
    `Days       : ${p.days}`,
    p.notes ? `Notes      : ${p.notes}` : null,
    '',
    `View your leave history:`,
    `${p.appUrl}/leave-requests`,
    '',
    '— Joot Leave Management',
  ].filter(l => l !== null).join('\n')

  await sendMail({ to: p.employeeEmail, subject, text, html: notifyRecallHtml(p) })
}

async function handleRunAccrual(p: RunAccrualPayload) {
  const now      = new Date()
  const today    = new Date(now); today.setHours(0, 0, 0, 0)
  // "This month" window — any lastAccrualDate within [monthStart, today] means already accrued
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const subsidiaries = await db.subsidiary.findMany({ select: { id: true, name: true } })

  let totalCredits = 0
  let totalSkipped = 0

  for (const sub of subsidiaries) {
    const leaveTypes = await db.leaveType.findMany({
      where: { subsidiaryId: sub.id, active: true },
      select: { id: true, name: true, maxDaysPerYear: true, expiryMonths: true },
    })

    const users = await db.user.findMany({
      where: { subsidiaryId: sub.id },
      select: { id: true, startDate: true },
    })

    for (const lt of leaveTypes) {
      if (!lt.maxDaysPerYear || lt.maxDaysPerYear <= 0) continue
      const increment = Math.round((lt.maxDaysPerYear / 12) * 100) / 100

      for (const user of users) {
        // Skip employees who haven't started yet
        const startDate = new Date(user.startDate); startDate.setHours(0, 0, 0, 0)
        if (startDate > today) { totalSkipped++; continue }

        const bal = await db.leaveBalance.findUnique({
          where:  { userId_leaveTypeId: { userId: user.id, leaveTypeId: lt.id } },
          select: { lastAccrualDate: true },
        })

        // Skip if already accrued this calendar month
        if (bal?.lastAccrualDate && bal.lastAccrualDate >= monthStart) {
          totalSkipped++; continue
        }

        const expiryDate = lt.expiryMonths
          ? new Date(now.getFullYear(), now.getMonth() + lt.expiryMonths, 1)
          : null

        await db.leaveBalance.upsert({
          where:  { userId_leaveTypeId: { userId: user.id, leaveTypeId: lt.id } },
          update: {
            accrued:         { increment },
            balance:         { increment },
            lastAccrualDate: today,
            ...(expiryDate ? { expiryDate } : {}),
          },
          create: {
            id:              randomUUID(),
            userId:          user.id,
            leaveTypeId:     lt.id,
            accrued:         increment,
            used:            0,
            balance:         increment,
            accrualRate:     increment,
            lastAccrualDate: today,
            ...(expiryDate ? { expiryDate } : {}),
          },
        })

        await db.auditEvent.create({
          data: {
            id:         randomUUID(),
            entityId:   user.id,
            entityType: 'leave_balance',
            eventType:  'accrual',
            actorId:    user.id,
            afterState: {
              leaveTypeId: lt.id,
              increment,
              triggeredBy: p.triggeredBy,
            },
          },
        })

        totalCredits++
      }
    }
  }

  console.log(
    `[accrual] done — subsidiaries: ${subsidiaries.length}, credits: ${totalCredits}, skipped: ${totalSkipped}`
  )
}

async function handleWarnExpiry(p: WarnExpiryPayload) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const fiveDaysAgo = new Date(today.getTime() - 5 * 86_400_000)

  // Two warning windows: ±1.5 days centred on 30 and 7 days before expiry
  const windows = [
    { label: '30-day', daysMin: 28, daysMax: 31 },
    { label: '7-day',  daysMin:  5, daysMax:  8 },
  ]

  let warnings = 0

  for (const win of windows) {
    const from = new Date(today); from.setDate(from.getDate() + win.daysMin)
    const to   = new Date(today); to.setDate(to.getDate() + win.daysMax)

    const balances = await db.leaveBalance.findMany({
      where: { expiryDate: { gte: from, lte: to }, balance: { gt: 0 } },
      include: {
        user:      { select: { id: true, email: true, fullName: true } },
        leaveType: { select: { name: true } },
      },
    })

    for (const bal of balances) {
      // Don't re-send within a 5-day window (tolerates cron jitter)
      const alreadySent = await db.auditEvent.findFirst({
        where: {
          entityId:   bal.id,
          entityType: 'leave_balance',
          eventType:  'expiry_warning',
          createdAt:  { gte: fiveDaysAgo },
        },
      })
      if (alreadySent) continue

      const daysLeft = Math.round(
        (new Date(bal.expiryDate!).getTime() - today.getTime()) / 86_400_000
      )
      const expStr = new Date(bal.expiryDate!).toLocaleDateString('en-ZA', {
        day: 'numeric', month: 'long', year: 'numeric',
      })

      const appUrl = process.env.APP_URL ?? process.env.BETTER_AUTH_URL ?? 'http://localhost:4000'
      await sendMail({
        to:      bal.user.email,
        subject: `Leave balance expiring in ${daysLeft} days — ${bal.leaveType.name}`,
        text: [
          `Hi ${bal.user.fullName},`,
          '',
          `Your ${bal.leaveType.name} balance of ${Number(bal.balance)} day(s) will expire on ${expStr}.`,
          '',
          `You have ${daysLeft} day(s) left to take this leave. Please plan accordingly.`,
          '',
          '— Joot Leave Management',
        ].join('\n'),
        html: warnExpiryHtml({
          employeeName:  bal.user.fullName,
          leaveTypeName: bal.leaveType.name,
          balance:       Number(bal.balance),
          daysLeft,
          expiryDate:    expStr,
          appUrl,
        }),
      })

      await db.auditEvent.create({
        data: {
          id:         randomUUID(),
          entityId:   bal.id,
          entityType: 'leave_balance',
          eventType:  'expiry_warning',
          actorId:    bal.userId,
          afterState: { leaveTypeId: bal.leaveTypeId, daysLeft, balance: Number(bal.balance), window: win.label, triggeredBy: p.triggeredBy },
        },
      })

      warnings++
    }
  }

  console.log(`[expiry-warning] done — ${warnings} warnings sent`)
}

export async function processJob(job: Job<JobData>) {
  const { type, payload } = job.data
  switch (type) {
    case 'notify-approver': return handleNotifyApprover(payload as NotifyApproverPayload)
    case 'notify-employee': return handleNotifyEmployee(payload as NotifyEmployeePayload)
    case 'notify-recall':   return handleNotifyRecall(payload as NotifyRecallPayload)
    case 'run-accrual':     return handleRunAccrual(payload as RunAccrualPayload)
    case 'warn-expiry':     return handleWarnExpiry(payload as WarnExpiryPayload)
    default: throw new Error(`Unknown job type: ${(job.data as any).type}`)
  }
}
