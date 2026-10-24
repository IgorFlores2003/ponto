export type AdminSession = { token: string; expires_at: number }

const KEYS = ['admin_token', 'admin_token_expires']

export function clearAdminSession() {
  for (const storage of [localStorage, sessionStorage]) for (const key of KEYS) storage.removeItem(key)
}

export function loadSavedToken(): string | null {
  const token = sessionStorage.getItem('admin_token') || localStorage.getItem('admin_token')
  const expiresAt = sessionStorage.getItem('admin_token_expires') || localStorage.getItem('admin_token_expires')
  if (!token || !expiresAt) return null
  if (!Number.isFinite(Number(expiresAt)) || Date.now() >= Number(expiresAt)) {
    clearAdminSession()
    return null
  }
  return token
}

/** Saves a new admin session; without `remember` it keeps the storage the previous session used. */
export function saveAdminSession(session: AdminSession, remember = !!localStorage.getItem('admin_token')) {
  clearAdminSession()
  const storage = remember ? localStorage : sessionStorage
  storage.setItem('admin_token', session.token)
  storage.setItem('admin_token_expires', String(session.expires_at))
}
