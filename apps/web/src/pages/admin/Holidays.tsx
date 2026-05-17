import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import {
  addHoliday, deleteHoliday, getHolidays, syncHolidays,
  type PublicHoliday,
} from '../../api'
import { useSubsidiary } from '../../SubsidiaryContext'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function Holidays() {
  const { subsidiary } = useSubsidiary()
  const subId = subsidiary?.id

  const [year, setYear]           = useState(new Date().getFullYear())
  const [rows, setRows]           = useState<PublicHoliday[]>([])
  const [loading, setLoading]     = useState(true)
  const [syncing, setSyncing]     = useState(false)
  const [syncMsg, setSyncMsg]     = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm]           = useState({ name: '', holidayDate: '', description: '' })
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  async function load(y = year) {
    setLoading(true)
    setRows(await getHolidays(y, subId))
    setLoading(false)
  }

  useEffect(() => { load(year) }, [year, subId])

  async function handleSync() {
    setSyncing(true)
    setSyncMsg('')
    setError('')
    try {
      const result = await syncHolidays(year, subId)
      setSyncMsg(`Sync complete — ${result.added} added, ${result.updated} updated, ${result.skipped} manual entries preserved`)
      await load(year)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSyncing(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this holiday?')) return
    await deleteHoliday(id)
    setRows(r => r.filter(h => h.id !== id))
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await addHoliday({ name: form.name, holidayDate: form.holidayDate, description: form.description || undefined, subsidiaryId: subId })
      setShowModal(false)
      setForm({ name: '', holidayDate: '', description: '' })
      await load(year)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Layout>
      <div className="page-header">
        <h1>Public Holidays</h1>
        <div className="page-header-actions">
          <div className="year-picker">
            <button className="btn-ghost btn-sm" onClick={() => setYear(y => y - 1)}>‹</button>
            <span className="year-label">{year}</span>
            <button className="btn-ghost btn-sm" onClick={() => setYear(y => y + 1)}>›</button>
          </div>
          <button className="btn-ghost" onClick={handleSync} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Sync from Nager.Date'}
          </button>
          <button className="btn-primary" onClick={() => { setShowModal(true); setError('') }}>
            Add holiday
          </button>
        </div>
      </div>

      {syncMsg && <p className="form-success">{syncMsg}</p>}
      {error   && <p className="form-error">{error}</p>}

      {loading ? <div className="page-loading">Loading…</div> : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead><tr>
              <th>Date</th>
              <th>Name</th>
              <th>Description</th>
              <th>Source</th>
              <th></th>
            </tr></thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={5} className="empty-cell">
                  No holidays for {year} — sync from Nager.Date or add manually
                </td></tr>
              )}
              {rows.map(h => (
                <tr key={h.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(h.holidayDate)}</td>
                  <td>{h.name}</td>
                  <td className="text-muted">{h.description ?? '—'}</td>
                  <td>
                    <span className={`status-badge ${h.source === 'manual' ? 'badge-manual' : 'badge-synced'}`}>
                      {h.source === 'manual' ? 'Manual' : 'Synced'}
                    </span>
                  </td>
                  <td>
                    <button className="btn-link btn-danger" onClick={() => handleDelete(h.id)}>Delete</button>
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
            <h2>Add holiday</h2>
            <form onSubmit={handleAdd}>
              <label>Date<input type="date" value={form.holidayDate} onChange={e => setForm(f => ({ ...f, holidayDate: e.target.value }))} required /></label>
              <label>Name<input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Workers Day" /></label>
              <label>Description (optional)<input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="English name or note" /></label>
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
