import { useState } from 'react'
import { FiLogIn } from 'react-icons/fi'
import PasswordInput from './PasswordInput'
import AdminSignup from './AdminSignup'
import PasswordRecovery from './PasswordRecovery'
import { api, ApiError, errorMessage, INPUT_CLASS, LABEL_CLASS } from './types'

interface Props {
  onLogin: (token: string) => void
  onBack: () => void
  initialMode?: 'login' | 'signup' | 'recover'
}

const REMEMBER_DURATION = 8 * 60 * 60 * 1000 // 8 horas

function loadSavedToken(): string | null {
  const token = sessionStorage.getItem('admin_token') || localStorage.getItem('admin_token')
  const expiresAt = sessionStorage.getItem('admin_token_expires') || localStorage.getItem('admin_token_expires')
  if (!token || !expiresAt) return null
  if (!Number.isFinite(Number(expiresAt)) || Date.now() >= Number(expiresAt)) {
    sessionStorage.removeItem('admin_token')
    sessionStorage.removeItem('admin_token_expires')
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_token_expires')
    return null
  }
  return token
}

export { loadSavedToken }

/** Tela de login do administrador. */
export default function AdminLogin({ onLogin, onBack, initialMode = 'login' }: Props) {
  const [signup, setSignup] = useState(initialMode === 'signup')
  const [recover, setRecover] = useState(initialMode === 'recover')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function login(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await api<{ token: string; expires_at: number }>('/auth/login', { username, password })
      if (rememberMe) {
        localStorage.setItem('admin_token', result.token)
        localStorage.setItem('admin_token_expires', String(Math.min(result.expires_at, Date.now() + REMEMBER_DURATION)))
      } else {
        localStorage.removeItem('admin_token')
        localStorage.removeItem('admin_token_expires')
      }
      onLogin(result.token)
      setPassword('')
    } catch (err) {
      setError(errorMessage(err))
      if (err instanceof ApiError && err.status === 429) {
        // rate limited — não limpa password para facilitar nova tentativa após espera
      } else {
        setPassword('')
      }
    } finally {
      setBusy(false)
    }
  }

  if (signup) return <AdminSignup onBack={() => setSignup(false)} />
  if (recover) return <PasswordRecovery onBack={() => setRecover(false)} />
  return (
    <section className="py-2">
      <span className="mb-1 block text-[10px] font-bold tracking-[0.14em] text-[#789185]">
        ACESSO RESTRITO
      </span>
      <h2 className="font-['Manrope',sans-serif] text-xl font-bold tracking-tight text-[#143f31]">
        Entrar como administrador
      </h2>
      <p className="mt-1 mb-6 text-xs text-[#82958b]">
        Use seu login administrativo aprovado para acessar os dados da empresa.
      </p>

      <form className="mb-5 grid gap-3.5" onSubmit={login}>
        <label className={LABEL_CLASS}>
          Usuário ou e-mail
          <input
            required
            type="text"
            autoCapitalize="none"
            spellCheck={false}
            autoComplete="username"
            value={username}
            className={INPUT_CLASS}
            onChange={e => setUsername(e.target.value)}
          />
        </label>

        <label className={LABEL_CLASS}>
          Senha
          <PasswordInput
            required
            autoComplete="current-password"
            value={password}
            className={INPUT_CLASS}
            onChange={e => setPassword(e.target.value)}
          />
        </label>

        <label className="flex w-fit cursor-pointer items-center gap-2.5 text-sm text-[#527566]">
          <input
            type="checkbox"
            className="size-4.5 rounded accent-[#317455]"
            checked={rememberMe}
            onChange={e => setRememberMe(e.target.checked)}
          />
          <span>Lembrar de mim por 8 horas</span>
        </label>

        <button
          type="submit"
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-[13px] bg-[#cef1d6] p-3.5 text-base font-bold text-[#173d2f] transition hover:bg-[#e1f9e6] disabled:opacity-55"
          disabled={busy}
        >
          <FiLogIn size={18} aria-hidden="true" />
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      {error && (
        <p role="alert" className="mb-5 rounded-xl border border-[#e5b8b8] bg-[#fff0f0] p-3 text-[13px] text-[#913939]">
          {error}
        </p>
      )}

      <div className="flex items-center justify-center gap-2 text-xs">
        <button type="button" disabled={busy} onClick={() => { setPassword(''); setError(''); setRecover(true) }} className="min-h-8 px-1 font-medium text-[#527566] underline-offset-2 hover:text-[#173d2f] hover:underline">Esqueci a senha</button>
        <span aria-hidden="true" className="text-[#a2b5aa]">·</span>
        <button type="button" disabled={busy} onClick={() => { setPassword(''); setError(''); setSignup(true) }} className="min-h-8 px-1 font-medium text-[#527566] underline-offset-2 hover:text-[#173d2f] hover:underline">Criar conta</button>
      </div>
      <button type="button" disabled={busy} onClick={onBack} className="mt-2 min-h-8 w-full text-xs font-medium text-[#82958b] hover:text-[#173d2f]">Voltar ao terminal de ponto</button>
    </section>
  )
}
