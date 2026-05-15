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

export interface AuthUser {
  id: string
  email: string
  name: string
  role: string | null
  subsidiaryId: string | null
}
