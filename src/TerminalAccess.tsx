import { useEffect, useState } from 'react'
import { FiLogIn, FiLogOut, FiLock } from 'react-icons/fi'
import Terminal from './Terminal'
import PasswordInput from './PasswordInput'
import ConfirmDialog from './ConfirmDialog'
import { api, ApiError, errorMessage, INPUT_CLASS, LABEL_CLASS } from './types'

type Session = { token: string; expires_at: number }
const STORAGE_KEY = 'terminal_session'
function clearSavedSession() {
  localStorage.removeItem(STORAGE_KEY)
  sessionStorage.removeItem(STORAGE_KEY)
}
export async function logoutTerminalSession() {
  let session: Session | null = null
  try {
    session = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY) || 'null')
  } catch { /* Invalid stored sessions are still removed below. */ }
  try { if (session?.token) await api('/terminal/logout', {}, session.token) }
  catch { /* Clear local credentials even if the server cannot be reached. */ }
  finally { clearSavedSession() }
}
function loadSession(): Session | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY) || 'null')
    if (saved && /^[a-f0-9]{64}$/.test(saved.token) && Number.isFinite(saved.expires_at) && saved.expires_at > Date.now()) return saved
  } catch { /* Invalid saved sessions must not open the terminal. */ }
  clearSavedSession()
  return null
}

type Props = { onAdmin?: (token: string) => void; onCreateAccount?: () => void; onForgotPassword?: () => void }
export default function TerminalAccess({ onAdmin, onCreateAccount, onForgotPassword }: Props) {
  const [session, setSession] = useState<Session | null>(loadSession)
  const [provider, setProvider] = useState<'local' | 'supabase' | null>(null)
  const [registrationEnabled, setRegistrationEnabled] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [checking, setChecking] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmLogout, setConfirmLogout] = useState(false)

  function exit(message = '') {
    clearSavedSession(); setSession(null); setConfirmLogout(false); setPassword(''); setError(message)
  }
  useEffect(() => {
    let active = true
    api<{ provider: 'local' | 'supabase'; registration_enabled: boolean }>('/auth/config')
      .then(value => { if (active) { setProvider(value.provider); setRegistrationEnabled(value.registration_enabled) } })
      .catch(err => { if (active) setError(errorMessage(err)) })
    return () => { active = false }
  }, [attempt])
  useEffect(() => {
    if (!session) { setChecking(false); return }
    let active = true
    setChecking(true)
    api('/terminal/me', undefined, session.token)
      .then(() => { if (active) { setChecking(false); setError('') } })
      .catch(err => {
        if (!active) return
        if (err instanceof ApiError && err.status === 401) exit('Sua sessão terminou. Entre novamente para liberar o terminal.')
        else setError(errorMessage(err))
      })
    const timeout = window.setTimeout(() => exit('Sua sessão terminou. Entre novamente para liberar o terminal.'), Math.max(0, session.expires_at - Date.now()))
    return () => { active = false; clearTimeout(timeout) }
  }, [session, attempt])

  async function loginWith(usernameValue: string, passwordValue: string) {
    setBusy(true); setError('')
    try {
      const result = await api<Session & { role: 'admin' | 'ponto' }>('/auth/login', { username: usernameValue, password: passwordValue })
      if (result.role !== 'admin' && result.role !== 'ponto') throw new Error('Perfil de acesso inválido.')
      clearSavedSession()
      for (const storage of [localStorage, sessionStorage]) {
        storage.removeItem('admin_token')
        storage.removeItem('admin_token_expires')
      }
      const storage = remember ? localStorage : sessionStorage
      if (result.role === 'admin') {
        storage.setItem('admin_token', result.token)
        storage.setItem('admin_token_expires', String(result.expires_at))
        onAdmin?.(result.token)
        return
      }
      storage.setItem(STORAGE_KEY, JSON.stringify({ token: result.token, expires_at: result.expires_at }))
      setSession(result); setPassword('')
    } catch (err) { setError(errorMessage(err)); setPassword('') }
    finally { setBusy(false) }
  }
  async function login(event: React.FormEvent) {
    event.preventDefault()
    await loginWith(username, password)
  }
  async function logout() {
    if (!session) return
    setBusy(true)
    try { await api('/terminal/logout', {}, session.token) }
    catch { /* Close access on this device even if the connection is unavailable. */ }
    finally { exit(); setBusy(false) }
  }
  const retry = () => { setError(''); setAttempt(value => value + 1) }

  if (session) return <>
    {confirmLogout && <ConfirmDialog title="Sair do terminal?" message="Este aparelho voltará para a tela de login do sistema." confirmLabel="Sair do terminal" danger busy={busy} onConfirm={() => void logout()} onCancel={() => setConfirmLogout(false)} />}
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <span className="text-sm font-bold text-[#315847]">{checking ? 'Verificando acesso…' : 'Terminal liberado'}</span>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => setConfirmLogout(true)} className="flex min-h-12 items-center gap-2 rounded-xl border border-[#9fbaa9] px-3 text-sm font-bold text-[#315847] disabled:opacity-55"><FiLogOut aria-hidden="true" /> Sair</button>
      </div>
    </div>
    {error && <p role="alert" className="my-3 rounded-xl bg-[#fff0f0] p-3 text-base text-[#913939]">{error}</p>}
    {checking ? <div role="status" className="py-6 text-base text-[#315847]">{error ? <button type="button" onClick={retry} className="min-h-12 rounded-xl border border-[#9fbaa9] px-4 font-bold">Tentar novamente</button> : 'Aguarde um momento…'}</div>
      : <Terminal token={session.token} onSessionExpired={() => exit('Sua sessão terminou. Entre novamente para liberar o terminal.')} />}
  </>

  return <section>
    <div className="mb-5 rounded-2xl bg-[#eaf5ee] p-4 text-[#234c37]">
      <FiLock size={28} aria-hidden="true" />
      <h2 className="mt-3 text-2xl font-bold">Entrar no Ponto Digital</h2>
      <p className="mt-2 text-base leading-relaxed">Entre com sua conta. Seu perfil de acesso abre automaticamente o batedor de ponto ou o painel administrativo.</p>
    </div>
    <form onSubmit={login} className="grid gap-4">
      <fieldset disabled={busy} className="grid gap-4">
        <label className={LABEL_CLASS}>Usuário ou e-mail
          <input required type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={event => setUsername(event.target.value)} className={INPUT_CLASS} />
        </label>
        <label className={LABEL_CLASS}>Senha de acesso
          <PasswordInput required autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} className={INPUT_CLASS} />
        </label>
        <label className="flex min-h-12 items-center gap-3 text-base text-[#315847]"><input type="checkbox" className="size-5 shrink-0 accent-[#317455]" checked={remember} onChange={event => setRemember(event.target.checked)} />Lembrar neste aparelho por até 8 horas</label>
        <button type="submit" disabled={!provider || busy} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#246841] p-3 text-base font-bold text-white disabled:opacity-55"><FiLogIn size={20} aria-hidden="true" />{busy ? 'Entrando…' : !provider ? 'Conectando…' : 'Entrar'}</button>
      </fieldset>
    </form>
    {error && <p role="alert" className="mt-4 rounded-xl bg-[#fff0f0] p-3 text-base text-[#913939]">{error}</p>}
    {!provider && error && <button type="button" onClick={retry} className="mt-3 min-h-12 rounded-xl border border-[#9fbaa9] px-4 font-bold text-[#315847]">Tentar novamente</button>}
    {registrationEnabled && (onForgotPassword || onCreateAccount) && <div className="mt-1 flex items-center justify-center gap-2 text-xs">
      {onForgotPassword && <button type="button" onClick={onForgotPassword} className="min-h-8 px-1 font-medium text-[#527566] underline-offset-2 hover:text-[#173d2f] hover:underline">Esqueci a senha</button>}
      {onForgotPassword && onCreateAccount && <span aria-hidden="true" className="text-[#a2b5aa]">·</span>}
      {onCreateAccount && <button type="button" onClick={onCreateAccount} className="min-h-8 px-1 font-medium text-[#527566] underline-offset-2 hover:text-[#173d2f] hover:underline">Criar conta</button>}
    </div>}
  </section>
}
