import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import { createLeaveType, getLeaveTypes, updateLeaveType, type LeaveType } from '../../api'
import { useSubsidiary } from '../../SubsidiaryContext'

const CATEGORIES = ['annual', 'sick', 'parental', 'maternity', 'compassionate', 'family_responsibility', 'custom']

const empty = {
  name: '', category: 'annual', maxDaysPerYear: '', allowNegative: false,
  expiryMonths: '', requiresDualApproval: false, bceaProtected: false,
}

type Form = typeof empty

export default function LeaveTypes() {
  const { subsidiaryId } = useSubsidiary()
  const [rows, setRows]       = useState<LeaveType[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<LeaveType | null>(null)
  const [form, setForm]       = useState<Form>(empty)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  async function load() {
    if (!subsidiaryId) return
    setLoading(true)
    setRows(await getLeaveTypes(subsidiaryId))
    setLoading(false)
  }

  useEffect(() => { load() }, [subsidiaryId])

  function openAdd() {
    setEditing(null)
    setForm(empty)
    setError('')
    setShowModal(true)
  }

  function openEdit(row: LeaveType) {
    setEditing(row)
    setForm({
      name:                row.name,
      category:            row.category,
      maxDaysPerYear:      row.maxDaysPerYear?.toString() ?? '',
      allowNegative:       row.allowNegative,
      expiryMonths:        row.expiryMonths?.toString() ?? '',
      requiresDualApproval: row.requiresDualApproval,
      bceaProtected:       row.bceaProtected,
    })
    setError('')
    setShowModal(true)
  }

  function set(field: string, value: string | boolean) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!subsidiaryId) return
    setSaving(true)
    setError('')
    try {
      const data = {
        name:                 form.name,
        category:             form.category,
        maxDaysPerYear:       form.maxDaysPerYear ? Number(form.maxDaysPerYear) : null,
        allowNegative:        form.allowNegative,
        expiryMonths:         form.expiryMonths ? Number(form.expiryMonths) : null,
        requiresDualApproval: form.requiresDualApproval,
        bceaProtected:        form.bceaProtected,
      }
      if (editing) {
        await updateLeaveType(editing.id, data)
      } else {
        await createLeaveType({ subsidiaryId, ...data })
      }
      await load()
      setShowModal(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Layout>
      <div className="page-header">
        <h1>Leave Types</h1>
        <button className="btn-primary" onClick={openAdd} disabled={!subsidiaryId}>Add leave type</button>
      </div>

      {!subsidiaryId && <div className="page-notice">Select a subsidiary to manage leave types.</div>}

      {subsidiaryId && (loading ? <div className="page-loading">Loading…</div> : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead><tr>
              <th>Name</th><th>Category</th><th>Max days/yr</th><th>BCEA</th><th>Status</th><th></th>
            </tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={6} className="empty-cell">No leave types yet</td></tr>}
              {rows.map(r => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.category.replace(/_/g, ' ')}</td>
                  <td>{r.maxDaysPerYear ?? '—'}</td>
                  <td>{r.bceaProtected ? '✓' : '—'}</td>
                  <td><span className={`status-badge ${r.active ? 'active' : 'inactive'}`}>{r.active ? 'Active' : 'Inactive'}</span></td>
                  <td><button className="btn-link" onClick={() => openEdit(r)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editing ? 'Edit leave type' : 'Add leave type'}</h2>
            <form onSubmit={handleSubmit}>
              <label>Name<input value={form.name} onChange={e => set('name', e.target.value)} required /></label>
              <label>Category
                <select value={form.category} onChange={e => set('category', e.target.value)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                </select>
              </label>
              <label>Max days per year<input type="number" min="0" value={form.maxDaysPerYear} onChange={e => set('maxDaysPerYear', e.target.value)} placeholder="Unlimited" /></label>
              <label>Expiry (months)<input type="number" min="0" value={form.expiryMonths} onChange={e => set('expiryMonths', e.target.value)} placeholder="No expiry" /></label>
              <div className="check-row">
                <label className="check-label"><input type="checkbox" checked={form.allowNegative} onChange={e => set('allowNegative', e.target.checked)} /> Allow negative balance</label>
                <label className="check-label"><input type="checkbox" checked={form.requiresDualApproval} onChange={e => set('requiresDualApproval', e.target.checked)} /> Dual approval required</label>
                <label className="check-label"><input type="checkbox" checked={form.bceaProtected} onChange={e => set('bceaProtected', e.target.checked)} /> BCEA protected</label>
              </div>
              {editing && (
                <label className="check-label"><input type="checkbox" checked={(form as any).active ?? true} onChange={e => set('active', e.target.checked)} /> Active</label>
              )}
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
