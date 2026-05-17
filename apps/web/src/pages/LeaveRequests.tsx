import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import {
  cancelLeaveRequest, getLeaveRequests, getLeaveTypes,
  recallLeaveRequest, submitLeaveRequest,
  type LeaveRequest, type LeaveType,
} from '../api'
import { useAuth } from '../auth'
import { useSubsidiary } from '../SubsidiaryContext'

const empty = { leaveTypeId: '', startDate: '', endDate: '', notes: '', includesHalfDay: false, halfDayPortion: 'morning' as const }

function statusLabel(s: string) {
  return s.replace(/_/g, ' ')
}

function statusClass(s: string) {
  if (s === 'approved') return 'status-badge active'
  if (s === 'rejected' || s === 'cancelled' || s === 'recalled') return 'status-badge inactive'
  return 'status-badge pending'
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function LeaveRequests() {
  const { user } = useAuth()
  const { subsidiaryId } = useSubsidiary()
  const [requests, setRequests]   = useState<LeaveRequest[]>([])
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm]           = useState(empty)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [acting, setActing]       = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const [reqs, types] = await Promise.all([
      getLeaveRequests(),
      subsidiaryId ? getLeaveTypes(subsidiaryId) : Promise.resolve([]),
    ])
    setRequests(reqs)
    setLeaveTypes(types.filter(t => t.active))
    setLoading(false)
  }

  useEffect(() => { load() }, [subsidiaryId])

  function openModal() {
    setForm(empty)
    setError('')
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await submitLeaveRequest({
        leaveTypeId:     form.leaveTypeId,
        startDate:       form.startDate,
        endDate:         form.endDate,
        notes:           form.notes || undefined,
        includesHalfDay: form.includesHalfDay,
        halfDayPortion:  form.includesHalfDay ? form.halfDayPortion : undefined,
      })
      await load()
      setShowModal(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleCancel(id: string) {
    if (!confirm('Cancel this leave request?')) return
    setActing(id)
    try { await cancelLeaveRequest(id); await load() }
    catch (err: any) { alert(err.message) }
    finally { setActing(null) }
  }

  async function handleRecall(id: string) {
    if (!confirm('Recall this approved leave request? The days will be restored to your balance.')) return
    setActing(id)
    try { await recallLeaveRequest(id); await load() }
    catch (err: any) { alert(err.message) }
    finally { setActing(null) }
  }

  const myId = (user as any)?.subsidiaryUserId ?? null

  return (
    <Layout>
      <div className="page-header">
        <h1>Leave Requests</h1>
        <button className="btn-primary" onClick={openModal}>Request leave</button>
      </div>

      {loading ? <div className="page-loading">Loading…</div> : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead><tr>
              <th>Employee</th><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Status</th><th></th>
            </tr></thead>
            <tbody>
              {requests.length === 0 && (
                <tr><td colSpan={7} className="empty-cell">No leave requests yet</td></tr>
              )}
              {requests.map(r => (
                <tr key={r.id}>
                  <td>{r.user.fullName}</td>
                  <td>{r.leaveType.name}</td>
                  <td>{fmt(r.startDate)}</td>
                  <td>{fmt(r.endDate)}</td>
                  <td>{Number(r.daysCalculated)}</td>
                  <td><span className={statusClass(r.status)}>{statusLabel(r.status)}</span></td>
                  <td>
                    {(r.status === 'pending_line_manager' || r.status === 'pending_apex' || r.status === 'draft') && (
                      <button
                        className="btn-link"
                        disabled={acting === r.id}
                        onClick={() => handleCancel(r.id)}
                      >Cancel</button>
                    )}
                    {r.status === 'approved' && (
                      <button
                        className="btn-link"
                        disabled={acting === r.id}
                        onClick={() => handleRecall(r.id)}
                      >Recall</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Request leave</h2>
            <form onSubmit={handleSubmit}>
              <label>Leave type
                <select
                  value={form.leaveTypeId}
                  onChange={e => setForm(f => ({ ...f, leaveTypeId: e.target.value }))}
                  required
                >
                  <option value="">— Select —</option>
                  {leaveTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
              <label>Start date
                <input type="date" value={form.startDate}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required />
              </label>
              <label>End date
                <input type="date" value={form.endDate}
                  onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} required />
              </label>
              <label className="check-label">
                <input type="checkbox" checked={form.includesHalfDay}
                  onChange={e => setForm(f => ({ ...f, includesHalfDay: e.target.checked }))} />
                Includes a half day
              </label>
              {form.includesHalfDay && (
                <label>Half-day portion
                  <select value={form.halfDayPortion}
                    onChange={e => setForm(f => ({ ...f, halfDayPortion: e.target.value as any }))}>
                    <option value="morning">Morning</option>
                    <option value="afternoon">Afternoon</option>
                  </select>
                </label>
              )}
              <label>Notes (optional)
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  style={{ resize: 'vertical' }}
                />
              </label>
              {error && <p className="form-error">{error}</p>}
              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Submitting…' : 'Submit'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
