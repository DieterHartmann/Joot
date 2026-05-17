import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import {
  adjustBalance, getMyBalances, getUserBalances, getUsers,
  type LeaveBalance, type SubsidiaryUser,
} from '../api'
import { useAuth } from '../auth'
import { useSubsidiary } from '../SubsidiaryContext'

const PRIVILEGED = ['holding_admin', 'subsidiary_admin', 'hr_director', 'ceo', 'manager']

const ADJUST_ROLES = ['holding_admin', 'subsidiary_admin', 'hr_director']

function balanceColor(balance: number, max: number | null) {
  if (balance <= 0) return '#dc2626'
  if (max && balance < max * 0.25) return '#d97706'
  return '#16a34a'
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function Balances() {
  const { user } = useAuth()
  const { subsidiaryId } = useSubsidiary()
  const role = user?.role ?? ''

  const [balances, setBalances]       = useState<LeaveBalance[]>([])
  const [users, setUsers]             = useState<SubsidiaryUser[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [loading, setLoading]         = useState(true)
  const [adjustModal, setAdjustModal] = useState<LeaveBalance | null>(null)
  const [adjustForm, setAdjustForm]   = useState({ delta: '', reason: '' })
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')

  const isPrivileged = PRIVILEGED.includes(role)
  const canAdjust    = ADJUST_ROLES.includes(role)

  async function loadBalances(userId?: string) {
    setLoading(true)
    const rows = userId
      ? await getUserBalances(userId)
      : await getMyBalances()
    setBalances(rows)
    setLoading(false)
  }

  useEffect(() => {
    if (isPrivileged && subsidiaryId) {
      getUsers(subsidiaryId).then(setUsers)
    }
    loadBalances()
  }, [subsidiaryId])

  function handleUserChange(userId: string) {
    setSelectedUserId(userId)
    if (userId) loadBalances(userId)
    else loadBalances()
  }

  function openAdjust(bal: LeaveBalance) {
    setAdjustForm({ delta: '', reason: '' })
    setError('')
    setAdjustModal(bal)
  }

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault()
    if (!adjustModal || !selectedUserId) return
    setSaving(true)
    setError('')
    try {
      await adjustBalance(selectedUserId, {
        leaveTypeId: adjustModal.leaveType.id,
        delta:       Number(adjustForm.delta),
        reason:      adjustForm.reason,
      })
      await loadBalances(selectedUserId)
      setAdjustModal(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const viewingUser = users.find(u => u.id === selectedUserId)

  return (
    <Layout>
      <div className="page-header">
        <h1>Leave Balances</h1>
        {isPrivileged && (
          <select
            className="user-picker"
            value={selectedUserId}
            onChange={e => handleUserChange(e.target.value)}
          >
            <option value="">My balance</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.fullName}</option>
            ))}
          </select>
        )}
      </div>

      {selectedUserId && viewingUser && (
        <p className="balance-viewing-label">
          Showing balances for <strong>{viewingUser.fullName}</strong>
        </p>
      )}

      {loading ? (
        <div className="page-loading">Loading…</div>
      ) : balances.length === 0 ? (
        <div className="page-notice">No active leave types configured for this subsidiary.</div>
      ) : (
        <div className="balance-grid">
          {balances.map(b => {
            const pct = b.leaveType.maxDaysPerYear
              ? Math.min(100, Math.round((b.balance / b.leaveType.maxDaysPerYear) * 100))
              : null
            const color = balanceColor(b.balance, b.leaveType.maxDaysPerYear)

            return (
              <div key={b.leaveType.id} className="balance-card">
                <div className="balance-card-header">
                  <span className="balance-type-name">{b.leaveType.name}</span>
                  <span className="role-badge">{b.leaveType.category.replace(/_/g, ' ')}</span>
                </div>

                <div className="balance-main" style={{ color }}>
                  {b.balance}
                  <span className="balance-unit">days</span>
                </div>

                {pct !== null && (
                  <div className="balance-bar-wrap">
                    <div className="balance-bar" style={{ width: `${pct}%`, background: color }} />
                  </div>
                )}

                <div className="balance-detail-row">
                  <span>Accrued</span><strong>{b.accrued}</strong>
                </div>
                <div className="balance-detail-row">
                  <span>Used</span><strong>{b.used}</strong>
                </div>
                {b.expiryDate && (
                  <div className="balance-detail-row">
                    <span>Expires</span><strong>{fmt(b.expiryDate)}</strong>
                  </div>
                )}
                {b.leaveType.maxDaysPerYear && (
                  <div className="balance-detail-row">
                    <span>Annual max</span><strong>{b.leaveType.maxDaysPerYear}</strong>
                  </div>
                )}

                {canAdjust && selectedUserId && (
                  <button className="btn-link balance-adjust-btn" onClick={() => openAdjust(b)}>
                    Adjust
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {adjustModal && (
        <div className="modal-overlay" onClick={() => setAdjustModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Adjust balance</h2>
            <p className="modal-subtitle">{adjustModal.leaveType.name} — {viewingUser?.fullName}</p>
            <form onSubmit={handleAdjust}>
              <label>
                Days to add / subtract
                <input
                  type="number"
                  step="0.5"
                  value={adjustForm.delta}
                  onChange={e => setAdjustForm(f => ({ ...f, delta: e.target.value }))}
                  placeholder="e.g. 2 or -1"
                  required
                  autoFocus
                />
              </label>
              <p className="hint">Positive adds days; negative deducts. Written to audit log.</p>
              <label>
                Reason
                <input
                  type="text"
                  value={adjustForm.reason}
                  onChange={e => setAdjustForm(f => ({ ...f, reason: e.target.value }))}
                  required
                  placeholder="e.g. Annual carry-over correction"
                />
              </label>
              {error && <p className="form-error">{error}</p>}
              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setAdjustModal(null)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Apply adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
