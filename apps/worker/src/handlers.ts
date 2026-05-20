import { randomUUID } from 'crypto'
import type { Job, JobData, NotifyApproverPayload, NotifyEmployeePayload, NotifyRecallPayload, RunAccrualPayload } from '@joot/queue'
import { db } from '@joot/db'
import { sendMail } from './mailer.js'

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

  await sendMail({ to: p.approverEmail, subject, text })
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

  await sendMail({ to: p.employeeEmail, subject, text })
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

  await sendMail({ to: p.employeeEmail, subject, text })
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

export async function processJob(job: Job<JobData>) {
  const { type, payload } = job.data
  switch (type) {
    case 'notify-approver': return handleNotifyApprover(payload as NotifyApproverPayload)
    case 'notify-employee': return handleNotifyEmployee(payload as NotifyEmployeePayload)
    case 'notify-recall':   return handleNotifyRecall(payload as NotifyRecallPayload)
    case 'run-accrual':     return handleRunAccrual(payload as RunAccrualPayload)
    default: throw new Error(`Unknown job type: ${(job.data as any).type}`)
  }
}
