import { NavLink, useNavigate } from 'react-router-dom'
import { signOut } from '../api'
import { useAuth } from '../auth'
import { useSubsidiary } from '../SubsidiaryContext'

const ADMIN_ROLES = ['holding_admin', 'subsidiary_admin', 'hr_director', 'ceo', 'manager']

export default function Sidebar() {
  const { user, refresh } = useAuth()
  const { subsidiary, subsidiaries, setSubsidiaryId } = useSubsidiary()
  const navigate = useNavigate()
  const role = user?.role ?? ''

  async function handleSignOut() {
    await signOut()
    await refresh()
    navigate('/login')
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">Joot</div>

      {role === 'holding_admin' && subsidiaries.length > 0 && (
        <div className="sidebar-subsidiary">
          <label className="sidebar-label">Subsidiary</label>
          <select
            value={subsidiary?.id ?? ''}
            onChange={e => setSubsidiaryId(e.target.value)}
          >
            {subsidiaries.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {role !== 'holding_admin' && subsidiary && (
        <div className="sidebar-subsidiary-name">{subsidiary.name}</div>
      )}

      <nav className="sidebar-nav">
        <span className="sidebar-section">Leave</span>
        <NavLink to="/" end>Dashboard</NavLink>
        <NavLink to="/leave-requests">My Leave</NavLink>
        <NavLink to="/balances">Balances</NavLink>
        {['holding_admin', 'subsidiary_admin', 'hr_director', 'ceo', 'manager'].includes(role) && (
          <NavLink to="/approvals">Approvals</NavLink>
        )}

        {ADMIN_ROLES.includes(role) && (
          <>
            <span className="sidebar-section">Administration</span>
            {role === 'holding_admin' && (
              <NavLink to="/admin/subsidiaries">Subsidiaries</NavLink>
            )}
            {['holding_admin', 'subsidiary_admin', 'hr_director', 'ceo', 'manager'].includes(role) && (
              <NavLink to="/admin/departments">Departments</NavLink>
            )}
            {['holding_admin', 'subsidiary_admin', 'hr_director'].includes(role) && (
              <NavLink to="/admin/leave-types">Leave Types</NavLink>
            )}
            {['holding_admin', 'subsidiary_admin', 'hr_director'].includes(role) && (
              <NavLink to="/admin/holidays">Public Holidays</NavLink>
            )}
            {ADMIN_ROLES.includes(role) && (
              <NavLink to="/admin/users">Users</NavLink>
            )}
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <span className="sidebar-user">{user?.name}</span>
        <button className="btn-ghost btn-sm" onClick={handleSignOut}>Sign out</button>
      </div>
    </aside>
  )
}
