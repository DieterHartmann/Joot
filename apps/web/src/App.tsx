import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import { SubsidiaryProvider } from './SubsidiaryContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import LeaveRequests from './pages/LeaveRequests'
import Approvals from './pages/Approvals'
import Balances from './pages/Balances'
import Subsidiaries from './pages/admin/Subsidiaries'
import Departments from './pages/admin/Departments'
import LeaveTypes from './pages/admin/LeaveTypes'
import Users from './pages/admin/Users'
import Holidays  from './pages/admin/Holidays'
import Deputies  from './pages/admin/Deputies'
import AuditLog  from './pages/admin/AuditLog'
import Jobs      from './pages/admin/Jobs'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading">Loading…</div>
  if (user) return <Navigate to="/" replace />
  return <>{children}</>
}

function RequireRole({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading">Loading…</div>
  if (!user || !roles.includes(user.role ?? '')) return <Navigate to="/" replace />
  return <>{children}</>
}

const ADMIN = ['holding_admin', 'subsidiary_admin', 'hr_director', 'ceo', 'manager']

export default function App() {
  return (
    <AuthProvider>
      <SubsidiaryProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<RedirectIfAuthed><Login /></RedirectIfAuthed>} />
            <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
            <Route path="/leave-requests" element={<RequireAuth><LeaveRequests /></RequireAuth>} />
            <Route path="/balances" element={<RequireAuth><Balances /></RequireAuth>} />
            <Route path="/approvals" element={
              <RequireRole roles={ADMIN}><Approvals /></RequireRole>
            } />
            <Route path="/admin/subsidiaries" element={
              <RequireRole roles={['holding_admin']}><Subsidiaries /></RequireRole>
            } />
            <Route path="/admin/departments" element={
              <RequireRole roles={ADMIN}><Departments /></RequireRole>
            } />
            <Route path="/admin/leave-types" element={
              <RequireRole roles={['holding_admin', 'subsidiary_admin', 'hr_director']}><LeaveTypes /></RequireRole>
            } />
            <Route path="/admin/users" element={
              <RequireRole roles={ADMIN}><Users /></RequireRole>
            } />
            <Route path="/admin/holidays" element={
              <RequireRole roles={['holding_admin', 'subsidiary_admin', 'hr_director']}><Holidays /></RequireRole>
            } />
            <Route path="/admin/deputies" element={
              <RequireRole roles={['holding_admin', 'subsidiary_admin', 'hr_director', 'ceo', 'manager']}><Deputies /></RequireRole>
            } />
            <Route path="/admin/audit" element={
              <RequireRole roles={['holding_admin', 'subsidiary_admin', 'hr_director', 'ceo']}><AuditLog /></RequireRole>
            } />
            <Route path="/admin/jobs" element={
              <RequireRole roles={['holding_admin', 'subsidiary_admin']}><Jobs /></RequireRole>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </SubsidiaryProvider>
    </AuthProvider>
  )
}
