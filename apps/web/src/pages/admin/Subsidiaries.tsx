import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import {
  createSubsidiary, getHoldingCompany, getSubsidiaries, updateSubsidiary,
  type Subsidiary,
} from '../../api'

const TIMEZONES = ['Africa/Johannesburg', 'UTC', 'Europe/London', 'America/New_York', 'Asia/Dubai']
const YEAR_TYPES = ['calendar', 'tax', 'anniversary']

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

const empty = { name: '', pgSchema: '', leaveYearType: 'calendar', timezone: 'Africa/Johannesburg' }

export default function Subsidiaries() {
  const [rows, setRows]       = useState<Subsidiary[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Subsidiary | null>(null)
  const [form, setForm]       = useState(empty)
  const [holdingId, setHoldingId] = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  async function load() {
    setLoading(true)
    const [subs, hc] = await Promise.all([getSubsidiaries(), getHoldingCompany()])
    setRows(subs)
    setHoldingId(hc.id)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openAdd() {
    setEditing(null)
    setForm(empty)
    setError('')
    setShowModal(true)
  }

  function openEdit(row: Subsidiary) {
    setEditing(row)
    setForm({ name: row.name, pgSchema: row.pgSchema, leaveYearType: row.leaveYearType, timezone: row.timezone })
    setError('')
    setShowModal(true)
  }

  function set(field: string, value: string) {
    setForm(f => {
      const next = { ...f, [field]: value }
      if (field === 'name' && !editing) next.pgSchema = slugify(value)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (editing) {
        await updateSubsidiary(editing.id, { name: form.name, leaveYearType: form.leaveYearType, timezone: form.timezone })
      } else {
        await createSubsidiary({ holdingCompanyId: holdingId, ...form })
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
        <h1>Subsidiaries</h1>
        <button className="btn-primary" onClick={openAdd}>Add subsidiary</button>
      </div>

      {loading ? <div className="page-loading">Loading…</div> : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead><tr>
              <th>Name</th><th>Schema</th><th>Leave year</th><th>Timezone</th><th></th>
            </tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={5} className="empty-cell">No subsidiaries yet</td></tr>}
              {rows.map(r => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td><code>{r.pgSchema}</code></td>
                  <td>{r.leaveYearType}</td>
                  <td>{r.timezone}</td>
                  <td><button className="btn-link" onClick={() => openEdit(r)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editing ? 'Edit subsidiary' : 'Add subsidiary'}</h2>
            <form onSubmit={handleSubmit}>
              <label>Name<input value={form.name} onChange={e => set('name', e.target.value)} required /></label>
              {!editing && (
                <label>DB schema<input value={form.pgSchema} onChange={e => set('pgSchema', e.target.value)} required /></label>
              )}
              <label>Leave year type
                <select value={form.leaveYearType} onChange={e => set('leaveYearType', e.target.value)}>
                  {YEAR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label>Timezone
                <select value={form.timezone} onChange={e => set('timezone', e.target.value)}>
                  {TIMEZONES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
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
