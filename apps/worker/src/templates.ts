// HTML email templates — inline styles only (email client compatibility).

const BRAND  = '#4f46e5'   // indigo-600
const BG     = '#f9fafb'
const CARD   = '#ffffff'
const TEXT   = '#111827'
const MUTED  = '#6b7280'
const BORDER = '#e5e7eb'

function base(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:${TEXT};">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 0;">
  <tr><td align="center">
    <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">
      <!-- Header -->
      <tr><td style="background:${BRAND};border-radius:8px 8px 0 0;padding:24px 32px;">
        <span style="font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px;">Joot</span>
        <span style="font-size:13px;color:rgba(255,255,255,0.7);margin-left:8px;">Leave Management</span>
      </td></tr>
      <!-- Body -->
      <tr><td style="background:${CARD};padding:32px;border-left:1px solid ${BORDER};border-right:1px solid ${BORDER};">
        ${body}
      </td></tr>
      <!-- Footer -->
      <tr><td style="background:${BG};border-radius:0 0 8px 8px;padding:16px 32px;border:1px solid ${BORDER};border-top:0;">
        <p style="margin:0;font-size:12px;color:${MUTED};text-align:center;">
          This message was sent by Joot Leave Management. Please do not reply to this email.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 12px 6px 0;font-size:13px;color:${MUTED};white-space:nowrap;vertical-align:top;">${label}</td>
    <td style="padding:6px 0;font-size:13px;font-weight:500;color:${TEXT};">${value}</td>
  </tr>`
}

function table(rows: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:20px 0;border:1px solid ${BORDER};border-radius:6px;padding:4px 12px;width:100%;">
    <tbody>${rows}</tbody>
  </table>`
}

function cta(href: string, label: string): string {
  return `<p style="margin:24px 0 0;text-align:center;">
    <a href="${href}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:6px;">${label}</a>
  </p>`
}

// ── Per-email templates ───────────────────────────────────────────────────────

export function notifyApproverHtml(p: {
  approverName: string; employeeName: string; stepSequence: number
  leaveTypeName: string; startDate: string; endDate: string; days: number
  notes?: string; appUrl: string
}): string {
  const body = `
    <h2 style="margin:0 0 8px;font-size:20px;">Approval required</h2>
    <p style="margin:0 0 4px;color:${MUTED};font-size:14px;">Hi ${p.approverName},</p>
    <p style="margin:12px 0;font-size:15px;">
      <strong>${p.employeeName}</strong> has submitted a leave request that requires your approval
      ${p.stepSequence > 1 ? `(Step ${p.stepSequence})` : ''}.
    </p>
    ${table([
      row('Leave type', p.leaveTypeName),
      row('From',       p.startDate),
      row('To',         p.endDate),
      row('Days',       String(p.days)),
      p.notes ? row('Notes', p.notes) : '',
    ].join(''))}
    ${cta(`${p.appUrl}/approvals`, 'Review request →')}`
  return base('Approval required', body)
}

export function notifyEmployeeHtml(p: {
  employeeName: string; status: 'approved' | 'rejected'; approverName: string
  leaveTypeName: string; startDate: string; endDate: string; days: number
  decisionNotes?: string; appUrl: string
}): string {
  const verb       = p.status === 'approved' ? 'approved' : 'rejected'
  const accentColor = p.status === 'approved' ? '#16a34a' : '#dc2626'
  const body = `
    <h2 style="margin:0 0 8px;font-size:20px;">Leave request <span style="color:${accentColor};">${verb}</span></h2>
    <p style="margin:0 0 4px;color:${MUTED};font-size:14px;">Hi ${p.employeeName},</p>
    <p style="margin:12px 0;font-size:15px;">
      Your leave request has been <strong style="color:${accentColor};">${verb}</strong> by ${p.approverName}.
    </p>
    ${table([
      row('Leave type', p.leaveTypeName),
      row('From',       p.startDate),
      row('To',         p.endDate),
      row('Days',       String(p.days)),
      p.decisionNotes ? row('Notes', p.decisionNotes) : '',
    ].join(''))}
    ${cta(`${p.appUrl}/leave-requests`, 'View my leave →')}`
  return base(`Leave request ${verb}`, body)
}

export function notifyRecallHtml(p: {
  employeeName: string; recalledByName: string
  leaveTypeName: string; startDate: string; endDate: string; days: number
  notes?: string; appUrl: string
}): string {
  const body = `
    <h2 style="margin:0 0 8px;font-size:20px;">Leave recalled</h2>
    <p style="margin:0 0 4px;color:${MUTED};font-size:14px;">Hi ${p.employeeName},</p>
    <p style="margin:12px 0;font-size:15px;">
      Your approved leave has been recalled by <strong>${p.recalledByName}</strong>.
      The days have been restored to your balance.
    </p>
    ${table([
      row('Leave type', p.leaveTypeName),
      row('From',       p.startDate),
      row('To',         p.endDate),
      row('Days',       String(p.days)),
      p.notes ? row('Notes', p.notes) : '',
    ].join(''))}
    ${cta(`${p.appUrl}/leave-requests`, 'View my leave →')}`
  return base('Leave recalled', body)
}

export function warnExpiryHtml(p: {
  employeeName: string; leaveTypeName: string
  balance: number; daysLeft: number; expiryDate: string
  appUrl: string
}): string {
  const urgency = p.daysLeft <= 7 ? '#dc2626' : '#d97706'
  const body = `
    <h2 style="margin:0 0 8px;font-size:20px;">Leave balance expiring soon</h2>
    <p style="margin:0 0 4px;color:${MUTED};font-size:14px;">Hi ${p.employeeName},</p>
    <p style="margin:12px 0;font-size:15px;">
      Your <strong>${p.leaveTypeName}</strong> balance of
      <strong style="color:${urgency};">${p.balance} day(s)</strong>
      will expire in <strong style="color:${urgency};">${p.daysLeft} day(s)</strong>.
    </p>
    ${table([
      row('Leave type',    p.leaveTypeName),
      row('Balance',       `${p.balance} day(s)`),
      row('Expires on',    p.expiryDate),
      row('Days remaining', String(p.daysLeft)),
    ].join(''))}
    <p style="margin:16px 0 0;font-size:14px;color:${MUTED};">Please plan your leave to avoid losing this balance.</p>
    ${cta(`${p.appUrl}/leave-requests`, 'Submit leave request →')}`
  return base('Leave balance expiring soon', body)
}
