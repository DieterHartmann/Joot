import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import { createUser, getDepartments, getUsers, updateUser, type Department, type SubsidiaryUser } from '../../api'
import { useAuth } from '../../auth'
import { useSubsidiary } from '../../SubsidiaryContext'

// Roles visible in the dropdown depend on who is managing
// holding_admin can see all roles; others cannot assign holding_admin
const ALL_ROLES = ['employee', 'manager', 'hr_director', 'ceo', 'subsidiary_admin', 'holding_admin']
const SUB_ROLES = ['employee', 'manager', 'hr_director', 'ceo', 'subsidiary_admin']

const emptyCreate = { email: '', fullName: '', password: '', role: 'employee', departmentId: '', startDate: '', ctc: '' }
const emptyEdit   = { fullName: '', role: 'employee', departmentId: '', ctc: '' }

export default function Users() {
  const { user: me } = useAuth()
  const { subsidiaryId } = useSubsidiary()
  const [users, setUsers]   = useState<SubsidiaryUser[]>([])
  const [depts, setDepts]   = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]   = useState<'none' | 'create' | 'edit'>('none')
  const [editing, setEditing] = useState<SubsidiaryUser | null>(null)
  const [createForm, setCreateForm] = useState(emptyCreate)
  const [editForm,   setEditForm]   = useState(emptyEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const roles = me?.role === 'holding_admin' ? ALL_ROLES : SUB_ROLES

  async function load() {
    if (!subsidiaryId) return
    setLoading(true)
    const [u, d] = await Promise.all([getUsers(subsidiaryId), getDepartments(subsidiaryId)])
    setUsers(u)
    setDepts(d)
    setLoading(false)
  }

  useEffect(() => { load() }, [subsidiaryId])

  function openCreate() {
    setCreateForm(emptyCreate)
    setError('')
    setModal('create')
  }

  function openEdit(u: SubsidiaryUser) {
    setEditing(u)
    setEditForm({ fullName: u.fullName, role: u.role, departmentId: u.departmentId ?? '', ctc: u.ctc })
    setError('')
    setModal('edit')
  }

  function setC(field: string, value: string) { setCreateForm(f => ({ ...f, [field]: value })) }
  function setE(field: string, value: string) { setEditForm(f => ({ ...f, [field]: value })) }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!subsidiaryId) return
    setSaving(true)
    setError('')
    try {
      await createUser({
        email:        createForm.email,
        fullName:     createForm.fullName,
        password:     createForm.password,
        subsidiaryId,
        departmentId: createForm.departmentId || undefined,
        role:         createForm.role,
        startDate:    createForm.startDate,
        ctc:          Number(createForm.ctc),
      })
      await load()
      setModal('none')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    setSaving(true)
    setError('')
    try {
      await updateUser(editing.id, {
        fullName:     editForm.fullName,
        departmentId: editForm.departmentId || null,
        role:         editForm.role,
        ctc:          Number(editForm.ctc),
      })
      await load()
      setModal('none')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function roleLabel(r: string) { return r.replace(/_/g, ' ') }
  function deptName(id: string | null) { return depts.find(d => d.id === id)?.name ?? '—' }

  return (
    <Layout>
      <div className="page-header">
        <h1>Users</h1>
        <button className="btn-primary" onClick={openCreate} disabled={!subsidiaryId}>Add user</button>
      </div>

      {!subsidiaryId && <div className="page-notice">Select a subsidiary to manage users.</div>}

      {subsidiaryId && (loading ? <div className="page-loading">Loading…</div> : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead><tr>
              <th>Name</th><th>Email</th><th>Role</th><th>Department</th><th></th>
            </tr></thead>
            <tbody>
              {users.length === 0 && <tr><td colSpan={5} className="empty-cell">No users yet</td></tr>}
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.fullName}</td>
                  <td>{u.email}</td>
                  <td><span className="role-badge">{roleLabel(u.role)}</span></td>
                  <td>{deptName(u.departmentId)}</td>
                  <td><button className="btn-link" onClick={() => openEdit(u)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {/* Create modal */}
      {modal === 'create' && (
        <div className="modal-overlay" onClick={() => setModal('none')}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <h2>Add user</h2>
            <form onSubmit={handleCreate}>
              <div className="form-grid">
                <label>Full name<input value={createForm.fullName} onChange={e => setC('fullName', e.target.value)} required /></label>
                <label>Email<input type="email" value={createForm.email} onChange={e => setC('email', e.target.value)} required /></label>
                <label>Password<input type="password" value={createForm.password} onChange={e => setC('password', e.target.value)} required minLength={8} /></label>
                <label>Role
                  <select value={createForm.role} onChange={e => setC('role', e.target.value)}>
                    {roles.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
                  </select>
                </label>
                <label>Department
                  <select value={createForm.departmentId} onChange={e => setC('departmentId', e.target.value)}>
                    <option value="">— Unassigned —</option>
                    {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </label>
                <label>Start date<input type="date" value={createForm.startDate} onChange={e => setC('startDate', e.target.value)} required /></label>
                <label>CTC (annual)<input type="number" min="0" step="0.01" value={createForm.ctc} onChange={e => setC('ctc', e.target.value)} required /></label>
              </div>
              {error && <p className="form-error">{error}</p>}
              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setModal('none')}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Add user'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {modal === 'edit' && editing && (
        <div className="modal-overlay" onClick={() => setModal('none')}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <h2>Edit user</h2>
            <p className="modal-subtitle">{editing.email}</p>
            <form onSubmit={handleEdit}>
              <div className="form-grid">
                <label>Full name<input value={editForm.fullName} onChange={e => setE('fullName', e.target.value)} required /></label>
                <label>Role
                  <select value={editForm.role} onChange={e => setE('role', e.target.value)}>
                    {roles.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
                  </select>
                </label>
                <label>Department
                  <select value={editForm.departmentId} onChange={e => setE('departmentId', e.target.value)}>
                    <option value="">— Unassigned —</option>
                    {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </label>
                <label>CTC (annual)<input type="number" min="0" step="0.01" value={editForm.ctc} onChange={e => setE('ctc', e.target.value)} /></label>
              </div>
              <p className="hint">Password changes are handled via email reset (Phase 5).</p>
              {error && <p className="form-error">{error}</p>}
              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setModal('none')}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
