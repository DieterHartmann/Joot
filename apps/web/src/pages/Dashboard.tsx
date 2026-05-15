import { useNavigate } from 'react-router-dom'
import { signOut } from '../api'
import { useAuth } from '../auth'

function roleLabel(role: string | null) {
  if (!role) return ''
  return role.replace(/_/g, ' ')
}

export default function Dashboard() {
  const { user, refresh } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    await refresh()
    navigate('/login')
  }

  return (
    <div className="dashboard">
      <header className="topbar">
        <span className="brand">Joot</span>
        <div className="topbar-right">
          <span className="user-name">{user?.name}</span>
          <button className="btn-ghost" onClick={handleSignOut}>Sign out</button>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="welcome-card">
          <h2>Welcome back, {user?.name?.split(' ')[0]}</h2>
          <p>{user?.email} · <span className="role-badge">{roleLabel(user?.role ?? null)}</span></p>
        </div>
      </main>
    </div>
  )
}
