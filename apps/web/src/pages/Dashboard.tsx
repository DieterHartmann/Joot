import Layout from '../components/Layout'
import { useAuth } from '../auth'
import { useSubsidiary } from '../SubsidiaryContext'

function roleLabel(role: string | null) {
  if (!role) return ''
  return role.replace(/_/g, ' ')
}

export default function Dashboard() {
  const { user } = useAuth()
  const { subsidiary } = useSubsidiary()

  return (
    <Layout>
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>

      <div className="dashboard-grid">
        <div className="info-card">
          <h3>Signed in as</h3>
          <p className="info-main">{user?.name}</p>
          <p className="info-sub">{user?.email}</p>
          <span className="role-badge">{roleLabel(user?.role ?? null)}</span>
        </div>

        {subsidiary && (
          <div className="info-card">
            <h3>Subsidiary</h3>
            <p className="info-main">{subsidiary.name}</p>
            <p className="info-sub">{subsidiary.timezone}</p>
          </div>
        )}
      </div>
    </Layout>
  )
}
