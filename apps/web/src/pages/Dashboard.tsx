import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../auth'
import { getMyBalances, getLeaveRequests, getPendingApprovals, type LeaveBalance, type LeaveRequest, type PendingApprovalStep } from '../api'

const MANAGER_ROLES = ['holding_admin', 'subsidiary_admin', 'hr_director', 'ceo', 'manager']

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function balanceColor(balance: number, accrued: number) {
  if (accrued === 0) return '#6b7280'
  const pct = balance / accrued
  if (pct > 0.5) return '#16a34a'
  if (pct > 0.2) return '#d97706'
  return '#dc2626'
}

function StatusBadge({ status }: { status: LeaveRequest['status'] }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending_line_manager: { label: 'Pending', cls: 'badge-pending' },
    pending_apex:         { label: 'Pending', cls: 'badge-pending' },
    approved:             { label: 'Approved', cls: 'badge-approved' },
    rejected:             { label: 'Rejected', cls: 'badge-rejected' },
    cancelled:            { label: 'Cancelled', cls: 'badge-cancelled' },
    recalled:             { label: 'Recalled', cls: 'badge-cancelled' },
    draft:                { label: 'Draft', cls: 'badge-manual' },
  }
  const b = map[status] ?? { label: status, cls: '' }
  return <span className={`status-badge ${b.cls}`}>{b.label}</span>
}

export default function Dashboard() {
  const { user } = useAuth()
  const isManager = MANAGER_ROLES.includes(user?.role ?? '')

  const [balances,  setBalances]  = useState<LeaveBalance[]>([])
  const [requests,  setRequests]  = useState<LeaveRequest[]>([])
  const [approvals, setApprovals] = useState<PendingApprovalStep[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    const loads: Promise<void>[] = [
      getMyBalances().then(setBalances),
      getLeaveRequests().then(setRequests),
    ]
    if (isManager) loads.push(getPendingApprovals().then(setApprovals))
    Promise.all(loads).finally(() => setLoading(false))
  }, [isManager])

  const todayStr   = today()
  const myRequests = requests.filter(r => r.userId === user?.id || !user?.id)

  const upcoming = myRequests
    .filter(r => r.status === 'approved' && r.startDate >= todayStr)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 3)

  const pendingMine = myRequests
    .filter(r => r.status === 'pending_line_manager' || r.status === 'pending_apex')

  const onLeaveToday = requests.filter(r =>
    r.status === 'approved' && r.startDate <= todayStr && r.endDate >= todayStr
  )

  if (loading) return <Layout><div className="page-loading">Loading…</div></Layout>

  return (
    <Layout>
      <div className="page-header">
        <h1>Dashboard</h1>
        <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
          {new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </span>
      </div>

      {/* ── Balance cards ────────────────────────────────────────────────── */}
      {balances.length > 0 && (
        <section className="dash-section">
          <h2 className="dash-section-title">My Leave Balances</h2>
          <div className="dash-balance-row">
            {balances.map(b => {
              const bal = Number(b.balance)
              const acc = Number(b.accrued)
              const used = Number(b.used)
              return (
                <div className="dash-balance-card" key={b.leaveType.id}>
                  <div className="dash-balance-type">{b.leaveType.name}</div>
                  <div className="dash-balance-days" style={{ color: balanceColor(bal, acc) }}>
                    {bal.toFixed(1)}
                    <span className="dash-balance-unit">days</span>
                  </div>
                  <div className="dash-balance-meta">
                    {acc.toFixed(1)} accrued &middot; {used.toFixed(1)} used
                  </div>
                  {b.expiryDate && (
                    <div className="dash-balance-expiry">
                      Expires {fmtDate(b.expiryDate)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      <div className="dash-cols">
        {/* ── Left column ─────────────────────────────────────────────────── */}
        <div>
          {/* Pending approvals alert — managers only */}
          {isManager && approvals.length > 0 && (
            <div className="dash-alert">
              <span>
                <strong>{approvals.length}</strong> leave request{approvals.length !== 1 ? 's' : ''} waiting for your approval
              </span>
              <Link to="/approvals" className="btn-primary btn-sm">Review</Link>
            </div>
          )}

          {/* My pending requests */}
          {pendingMine.length > 0 && (
            <section className="dash-section">
              <h2 className="dash-section-title">My Pending Requests</h2>
              <div className="dash-card">
                {pendingMine.map(r => (
                  <div key={r.id} className="dash-list-row">
                    <div>
                      <div className="dash-list-primary">{r.leaveType.name}</div>
                      <div className="dash-list-sub">{fmtDate(r.startDate)} — {fmtDate(r.endDate)} &middot; {r.daysCalculated} days</div>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Upcoming approved leave */}
          <section className="dash-section">
            <h2 className="dash-section-title">Upcoming Leave</h2>
            {upcoming.length === 0 ? (
              <p className="dash-empty">No approved leave coming up. <Link to="/leave-requests">Submit a request →</Link></p>
            ) : (
              <div className="dash-card">
                {upcoming.map(r => (
                  <div key={r.id} className="dash-list-row">
                    <div>
                      <div className="dash-list-primary">{r.leaveType.name}</div>
                      <div className="dash-list-sub">{fmtDate(r.startDate)} — {fmtDate(r.endDate)} &middot; {r.daysCalculated} days</div>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ── Right column — managers only ────────────────────────────────── */}
        {isManager && (
          <div>
            <section className="dash-section">
              <h2 className="dash-section-title">On Leave Today</h2>
              {onLeaveToday.length === 0 ? (
                <p className="dash-empty">Nobody is on leave today.</p>
              ) : (
                <div className="dash-card">
                  {onLeaveToday.map(r => (
                    <div key={r.id} className="dash-list-row">
                      <div>
                        <div className="dash-list-primary">{r.user.fullName}</div>
                        <div className="dash-list-sub">{r.leaveType.name} &middot; back {fmtDate(r.endDate)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </Layout>
  )
}
