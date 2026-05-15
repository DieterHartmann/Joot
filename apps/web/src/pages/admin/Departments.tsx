import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import { createDepartment, getDepartments, getUsers, updateDepartment, type Department, type SubsidiaryUser } from '../../api'
import { useSubsidiary } from '../../SubsidiaryContext'

const empty = { name: '', parentDepartmentId: '', defaultApproverId: '', apexApproverId: '' }

export default function Departments() {
  const { subsidiaryId } = useSubsidiary()
  const [depts, setDepts]   = useState<Department[]>([])
  const [users, setUsers]   = useState<SubsidiaryUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Department | null>(null)
  const [form, setForm]     = useState(empty)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function load() {
    if (!subsidiaryId) return
    setLoading(true)
    const [d, u] = await Promise.all([getDepartments(subsidiaryId), getUsers(subsidiaryId)])
    setDepts(d)
    setUsers(u)
    setLoading(false)
  }

  useEffect(() => { load() }, [subsidiaryId])

  function openAdd() {
    setEditing(null)
    setForm(empty)
    setError('')
    setShowModal(true)
  }

  function openEdit(row: Department) {
    setEditing(row)
    setForm({
      name:               row.name,
      parentDepartmentId: row.parentDepartmentId ?? '',
      defaultApproverId:  row.defaultApproverId  ?? '',
      apexApproverId:     row.apexApproverId     ?? '',
    })
    setError('')
    setShowModal(true)
  }

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!subsidiaryId) return
    setSaving(true)
    setError('')
    try {
      const data = {
        name:               form.name,
        parentDepartmentId: form.parentDepartmentId || undefined,
        defaultApproverId:  form.defaultApproverId  || undefined,
        apexApproverId:     form.apexApproverId     || undefined,
      }
      if (editing) {
        await updateDepartment(editing.id, data)
      } else {
        await createDepartment({ subsidiaryId, ...data })
      }
      await load()
      setShowModal(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const indent = (depth: number) => '    '.repeat(depth)
  const userName = (id: string | null) => users.find(u => u.id === id)?.fullName ?? '—'

  return (
    <Layout>
      <div className="page-header">
        <h1>Departments</h1>
        <button className="btn-primary" onClick={openAdd} disabled={!subsidiaryId}>Add department</button>
      </div>

      {!subsidiaryId && <div className="page-notice">Select a subsidiary to manage departments.</div>}

      {subsidiaryId && (loading ? <div className="page-loading">Loading…</div> : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead><tr>
              <th>Name</th><th>Default approver</th><th>Apex approver</th><th></th>
            </tr></thead>
            <tbody>
              {depts.length === 0 && <tr><td colSpan={4} className="empty-cell">No departments yet</td></tr>}
              {depts.map(d => (
                <tr key={d.id}>
                  <td>{indent(d.treeDepth)}{d.name}</td>
                  <td>{userName(d.defaultApproverId)}</td>
                  <td>{userName(d.apexApproverId)}</td>
                  <td><button className="btn-link" onClick={() => openEdit(d)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editing ? 'Edit department' : 'Add department'}</h2>
            <form onSubmit={handleSubmit}>
              <label>Name<input value={form.name} onChange={e => set('name', e.target.value)} required /></label>
              <label>Parent department
                <select value={form.parentDepartmentId} onChange={e => set('parentDepartmentId', e.target.value)}>
                  <option value="">— None (root) —</option>
                  {depts.filter(d => d.id !== editing?.id).map(d => (
                    <option key={d.id} value={d.id}>{' '.repeat(d.treeDepth * 2)}{d.name}</option>
                  ))}
                </select>
              </label>
              <label>Default approver
                <select value={form.defaultApproverId} onChange={e => set('defaultApproverId', e.target.value)}>
                  <option value="">— Unset —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                </select>
              </label>
              <label>Apex approver
                <select value={form.apexApproverId} onChange={e => set('apexApproverId', e.target.value)}>
                  <option value="">— None —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
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
