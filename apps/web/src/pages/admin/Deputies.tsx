import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import {
  createDeputy, deleteDeputy, getDeputies, getUsers,
  type DeputyAssignment, type SubsidiaryUser,
} from '../../api'
import { useAuth } from '../../auth'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

const MANAGE_ROLES = ['holding_admin', 'subsidiary_admin', 'hr_director', 'ceo']

const blank = { userId: '', deputyId: '', validFrom: '', validTo: '', isPermanent: false, isTemporaryOverride: false }

export default function Deputies() {
  const { user }  = useAuth()
  const canManage = MANAGE_ROLES.includes(user?.role ?? '')

  const [rows,      setRows]      = useState<DeputyAssignment[]>([])
  const [users,     setUsers]     = useState<SubsidiaryUser[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form,      setForm]      = useState(blank)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  async function load() {
    setLoading(true)
    const [assignments, userList] = await Promise.all([getDeputies(), getUsers()])
    setRows(assignments)
    setUsers(userList)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleDelete(id: string) {
    if (!confirm('Remove this deputy assignment?')) return
    await deleteDeputy(id)
    setRows(r => r.filter(a => a.id !== id))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.userId === form.deputyId) { setError('A person cannot be their own deputy'); return }
    setSaving(true)
    setError('')
    try {
      const created = await createDeputy({
        userId:              form.userId,
        deputyId:            form.deputyId,
        validFrom:           form.validFrom,
        validTo:             form.isPermanent ? null : (form.validTo || null),
        isPermanent:         form.isPermanent,
        isTemporaryOverride: form.isTemporaryOverride,
      })
      setRows(r => [created, ...r])
      setShowModal(false)
      setForm(blank)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function assignmentType(a: DeputyAssignment) {
    if (a.isPermanent)         return { label: 'Permanent',   cls: 'badge-approved' }
    if (a.isTemporaryOverride) return { label: 'Override',    cls: 'badge-pending' }
    return                            { label: 'Standard',    cls: 'badge-manual' }
  }

  return (
    <Layout>
      <div className="page-header">
        <h1>Deputies</h1>
        {canManage && (
          <button className="btn-primary" onClick={() => { setShowModal(true); setError('') }}>
            Add assignment
          </button>
        )}
      </div>

      {loading ? <div className="page-loading">Loading…</div> : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead><tr>
              <th>Employee</th>
              <th>Deputy</th>
              <th>Valid from</th>
              <th>Valid to</th>
              <th>Type</th>
              {canManage && <th></th>}
            </tr></thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={canManage ? 6 : 5} className="empty-cell">
                  No deputy assignments configured
                </td></tr>
              )}
              {rows.map(a => {
                const t = assignmentType(a)
                return (
                  <tr key={a.id}>
                    <td>
                      <span>{a.user.fullName}</span>
                      <span className="text-muted" style={{ display: 'block', fontSize: '0.8em' }}>{a.user.email}</span>
                    </td>
                    <td>
                      <span>{a.deputy.fullName}</span>
                      <span className="text-muted" style={{ display: 'block', fontSize: '0.8em' }}>{a.deputy.email}</span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(a.validFrom)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {a.isPermanent ? <span className="text-muted">—</span> : (a.validTo ? fmtDate(a.validTo) : <span className="text-muted">Open</span>)}
                    </td>
                    <td><span className={`status-badge ${t.cls}`}>{t.label}</span></td>
                    {canManage && (
                      <td>
                        <button className="btn-link btn-danger" onClick={() => handleDelete(a.id)}>Remove</button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Add deputy assignment</h2>
            <form onSubmit={handleSubmit}>
              <label>Employee being covered
                <select value={form.userId} onChange={e => setForm(f => ({ ...f, userId: e.target.value }))} required>
                  <option value="">Select employee…</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>)}
                </select>
              </label>
              <label>Deputy (acting on their behalf)
                <select value={form.deputyId} onChange={e => setForm(f => ({ ...f, deputyId: e.target.value }))} required>
                  <option value="">Select deputy…</option>
                  {users.filter(u => u.id !== form.userId).map(u => <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>)}
                </select>
              </label>
              <label>Valid from
                <input type="date" value={form.validFrom} onChange={e => setForm(f => ({ ...f, validFrom: e.target.value }))} required />
              </label>
              {!form.isPermanent && (
                <label>Valid to (optional)
                  <input type="date" value={form.validTo} onChange={e => setForm(f => ({ ...f, validTo: e.target.value }))} min={form.validFrom || undefined} />
                </label>
              )}
              <label className="check-label">
                <input type="checkbox" checked={form.isPermanent} onChange={e => setForm(f => ({ ...f, isPermanent: e.target.checked, validTo: '' }))} />
                Permanent assignment (no end date)
              </label>
              <label className="check-label">
                <input type="checkbox" checked={form.isTemporaryOverride} onChange={e => setForm(f => ({ ...f, isTemporaryOverride: e.target.checked }))} />
                Temporary override (bypasses normal approval routing)
              </label>
              {error && <p className="form-error">{error}</p>}
              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
