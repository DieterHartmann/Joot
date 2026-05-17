// ── Auth ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  email: string
  name: string
  role: string | null
  subsidiaryId: string | null
}

export async function signIn(email: string, password: string) {
  const res = await fetch('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Invalid credentials')
  return res.json()
}

export async function signOut() {
  await fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include' })
}

export async function getMe(): Promise<{ authUser: AuthUser; subsidiaryUser: unknown } | null> {
  const res = await fetch('/api/me', { credentials: 'include' })
  if (res.status === 401) return null
  return res.json()
}

// ── Holding company ──────────────────────────────────────────────────────────

export interface HoldingCompany {
  id: string
  name: string
  schemaName: string
}

export async function getHoldingCompany(): Promise<HoldingCompany> {
  const res = await fetch('/api/holding-company', { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to load holding company')
  return res.json()
}

// ── Subsidiaries ─────────────────────────────────────────────────────────────

export interface Subsidiary {
  id: string
  holdingCompanyId: string
  name: string
  pgSchema: string
  leaveYearType: string
  timezone: string
  publicHolidaysExcluded: boolean
  createdAt: string
}

export async function getSubsidiaries(): Promise<Subsidiary[]> {
  const res = await fetch('/api/subsidiaries', { credentials: 'include' })
  if (!res.ok) return []
  return res.json()
}

export async function createSubsidiary(data: {
  holdingCompanyId: string
  name: string
  pgSchema: string
  leaveYearType: string
  timezone: string
}): Promise<Subsidiary> {
  const res = await fetch('/api/subsidiaries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include',
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function updateSubsidiary(id: string, data: {
  name?: string
  leaveYearType?: string
  timezone?: string
  publicHolidaysExcluded?: boolean
}): Promise<Subsidiary> {
  const res = await fetch(`/api/subsidiaries/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include',
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ── Departments ──────────────────────────────────────────────────────────────

export interface Department {
  id: string
  subsidiaryId: string
  name: string
  parentDepartmentId: string | null
  defaultApproverId: string | null
  apexApproverId: string | null
  treePath: string
  treePathLabel: string
  treeDepth: number
}

export async function getDepartments(subsidiaryId?: string): Promise<Department[]> {
  const url = subsidiaryId ? `/api/departments?subsidiaryId=${subsidiaryId}` : '/api/departments'
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) return []
  return res.json()
}

export async function createDepartment(data: {
  subsidiaryId: string
  name: string
  parentDepartmentId?: string
  defaultApproverId?: string
  apexApproverId?: string
}): Promise<Department> {
  const res = await fetch('/api/departments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include',
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function updateDepartment(id: string, data: {
  name?: string
  parentDepartmentId?: string | null
  defaultApproverId?: string | null
  apexApproverId?: string | null
}): Promise<Department> {
  const res = await fetch(`/api/departments/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include',
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ── Leave types ──────────────────────────────────────────────────────────────

export interface LeaveType {
  id: string
  subsidiaryId: string
  name: string
  category: string
  maxDaysPerYear: number | null
  allowNegative: boolean
  expiryMonths: number | null
  requiresDualApproval: boolean
  bceaProtected: boolean
  active: boolean
}

export async function getLeaveTypes(subsidiaryId?: string): Promise<LeaveType[]> {
  const url = subsidiaryId ? `/api/leave-types?subsidiaryId=${subsidiaryId}` : '/api/leave-types'
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) return []
  return res.json()
}

export async function createLeaveType(data: {
  subsidiaryId: string
  name: string
  category: string
  maxDaysPerYear?: number | null
  allowNegative?: boolean
  expiryMonths?: number | null
  requiresDualApproval?: boolean
  bceaProtected?: boolean
}): Promise<LeaveType> {
  const res = await fetch('/api/leave-types', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include',
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function updateLeaveType(id: string, data: {
  name?: string
  maxDaysPerYear?: number | null
  allowNegative?: boolean
  expiryMonths?: number | null
  requiresDualApproval?: boolean
  bceaProtected?: boolean
  active?: boolean
}): Promise<LeaveType> {
  const res = await fetch(`/api/leave-types/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include',
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ── Users ────────────────────────────────────────────────────────────────────

export interface SubsidiaryUser {
  id: string
  email: string
  fullName: string
  role: string
  departmentId: string | null
  subsidiaryId: string
  startDate: string
  ctc: string
  department?: { id: string; name: string } | null
}

export async function getUsers(subsidiaryId?: string): Promise<SubsidiaryUser[]> {
  const url = subsidiaryId ? `/api/users?subsidiaryId=${subsidiaryId}` : '/api/users'
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) return []
  return res.json()
}

export async function createUser(data: {
  email: string
  fullName: string
  password: string
  subsidiaryId: string
  departmentId?: string
  role: string
  startDate: string
  ctc: number
}): Promise<SubsidiaryUser> {
  const res = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include',
  })
  if (!res.ok) throw new Error(await res.text())
  const body = await res.json()
  return body.user ?? body
}

export async function updateUser(id: string, data: {
  fullName?: string
  departmentId?: string | null
  role?: string
  ctc?: number
}): Promise<SubsidiaryUser> {
  const res = await fetch(`/api/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include',
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ── Leave requests ───────────────────────────────────────────────────────────

export interface ApprovalStep {
  id: string
  leaveRequestId: string
  approverId: string
  approver: { id: string; fullName: string }
  sequence: number
  status: 'pending' | 'approved' | 'rejected' | 'delegated'
  decisionNotes: string | null
  decidedAt: string | null
}

export interface LeaveRequest {
  id: string
  userId: string
  user: { id: string; fullName: string; email: string }
  leaveTypeId: string
  leaveType: { id: string; name: string; category: string }
  startDate: string
  endDate: string
  daysCalculated: string
  includesHalfDay: boolean
  halfDayPortion: 'morning' | 'afternoon' | null
  status: 'draft' | 'pending_line_manager' | 'pending_apex' | 'approved' | 'rejected' | 'cancelled' | 'recalled'
  notes: string | null
  isBackdated: boolean
  createdAt: string
  approvalSteps: ApprovalStep[]
}

export async function getLeaveRequests(): Promise<LeaveRequest[]> {
  const res = await fetch('/api/leave-requests', { credentials: 'include' })
  if (!res.ok) return []
  return res.json()
}

export async function submitLeaveRequest(data: {
  leaveTypeId: string
  startDate: string
  endDate: string
  notes?: string
  includesHalfDay?: boolean
  halfDayPortion?: 'morning' | 'afternoon'
}): Promise<LeaveRequest> {
  const res = await fetch('/api/leave-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include',
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function cancelLeaveRequest(id: string): Promise<void> {
  const res = await fetch(`/api/leave-requests/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  if (!res.ok) throw new Error(await res.text())
}

export async function recallLeaveRequest(id: string, notes?: string): Promise<void> {
  const res = await fetch(`/api/leave-requests/${id}/recall`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
    credentials: 'include',
  })
  if (!res.ok) throw new Error(await res.text())
}

// ── Approvals ────────────────────────────────────────────────────────────────

export interface PendingApprovalStep {
  id: string
  sequence: number
  leaveRequest: LeaveRequest
}

export async function getPendingApprovals(): Promise<PendingApprovalStep[]> {
  const res = await fetch('/api/approvals', { credentials: 'include' })
  if (!res.ok) return []
  return res.json()
}

export async function approveStep(stepId: string, notes?: string): Promise<void> {
  const res = await fetch(`/api/approvals/${stepId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
    credentials: 'include',
  })
  if (!res.ok) throw new Error(await res.text())
}

export async function rejectStep(stepId: string, notes?: string): Promise<void> {
  const res = await fetch(`/api/approvals/${stepId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
    credentials: 'include',
  })
  if (!res.ok) throw new Error(await res.text())
}
