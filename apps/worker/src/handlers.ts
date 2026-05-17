import type { Job, JobData, NotifyApproverPayload, NotifyEmployeePayload, NotifyRecallPayload } from '@joot/queue'
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

export async function processJob(job: Job<JobData>) {
  const { type, payload } = job.data
  switch (type) {
    case 'notify-approver': return handleNotifyApprover(payload as NotifyApproverPayload)
    case 'notify-employee': return handleNotifyEmployee(payload as NotifyEmployeePayload)
    case 'notify-recall':   return handleNotifyRecall(payload as NotifyRecallPayload)
    default: throw new Error(`Unknown job type: ${(job.data as any).type}`)
  }
}
