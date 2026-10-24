import { useState } from 'react'
import PasswordInput from './PasswordInput'
import OneTimeCodeInput from './OneTimeCodeInput'
import { api, errorMessage, INPUT_CLASS, LABEL_CLASS } from './types'
import type { AdminSession } from './adminSession'

const PENDING_EMAIL_KEY = 'pending_admin_signup_email'
function pendingEmail() {
  try { return localStorage.getItem(PENDING_EMAIL_KEY) || '' } catch { return '' }
}
function savePendingEmail(email: string) {
  try {
    if (email) localStorage.setItem(PENDING_EMAIL_KEY, email)
    else localStorage.removeItem(PENDING_EMAIL_KEY)
  } catch { /* Registration still works when browser storage is unavailable. */ }
}

export default function AdminSignup({ onBack, onLogin }: { onBack: () => void; onLogin: (session: AdminSession) => void }) {
  const [step, setStep] = useState<'signup' | 'resume' | 'sent' | 'verify' | 'done'>(() => pendingEmail() ? 'resume' : 'signup')
  const [name, setName] = useState('')
  const [email, setEmail] = useState(pendingEmail)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const buttonClass = 'min-h-12 rounded-xl bg-[#cef1d6] px-4 py-3 font-bold text-[#173d2f] disabled:opacity-55'

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setMessage('')
    if (step === 'signup' && password !== confirmation) { setError('As senhas precisam ser iguais.'); return }
    setBusy(true)
    try {
      const result = await api<Partial<AdminSession> & { message: string }>(step === 'signup' ? '/auth/signup' : '/auth/verify-email',
        step === 'signup' ? { name, email, password } : { email, code })
      setMessage(result.message); setPassword(''); setConfirmation('')
      savePendingEmail(step === 'signup' ? email.trim().toLowerCase() : '')
      if (result.token && result.expires_at) { onLogin({ token: result.token, expires_at: result.expires_at }); return }
      setStep(step === 'signup' ? 'sent' : 'done')
    } catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }
  async function resend() {
    setBusy(true); setError(''); setMessage('')
    try { setMessage((await api<{ message: string }>('/auth/resend', { email })).message) }
    catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }
  return <section className="grid gap-4 py-2">
    <h2 className="text-xl font-bold text-[#143f31]">{step === 'signup' ? 'Criar conta' : step === 'resume' ? 'Retomar confirmação' : step === 'sent' ? 'Confirme seu e-mail' : step === 'verify' ? 'Digite o código' : 'Aguardando aprovação'}</h2>
    <p className="text-sm text-[#527566]">{step === 'signup'
      ? 'Cadastre seu acesso à área administrativa. Você precisará confirmar seu e-mail e receber aprovação de um administrador da empresa.'
      : step === 'resume' ? 'Seu cadastro ainda precisa da confirmação do e-mail. Confira o endereço para continuar de onde parou.'
      : step === 'sent' ? `Enviamos um código de confirmação para ${email}. Abra sua caixa de entrada (e confira o spam) e depois avance para informar o código.`
        : step === 'verify' ? `Informe o código enviado para ${email}. Confira também a pasta de spam.`
        : 'Seu cadastro não libera acesso aos dados da empresa até ser aprovado. Depois da aprovação, entre usando seu e-mail e senha.'}</p>
    {message && <p role="status" className="rounded-xl bg-[#eaf5ee] p-3 text-sm text-[#234c37]">{message}</p>}
    {error && <p role="alert" aria-live="assertive" className="rounded-xl border border-[#edc6c6] bg-[#fff0f0] p-3 text-sm font-semibold text-[#913939]">{error}</p>}
    {step === 'resume' && <form onSubmit={event => { event.preventDefault(); savePendingEmail(email.trim().toLowerCase()); setCode(''); setError(''); setMessage(''); setStep('verify') }} className="grid gap-4">
      <label className={LABEL_CLASS}>E-mail
        <input required type="email" maxLength={254} autoComplete="email" autoCapitalize="none" value={email} onChange={event => setEmail(event.target.value)} className={INPUT_CLASS} />
      </label>
      <button type="submit" className={buttonClass}>Informar código recebido</button>
      <button type="button" onClick={() => { setStep('signup'); setError(''); setMessage('') }} className="min-h-10 text-sm font-semibold text-[#317455]">Criar outro cadastro</button>
    </form>}
    {(step === 'signup' || step === 'verify') && <form onSubmit={submit}>
      <fieldset disabled={busy} className="grid gap-4">
        {step === 'signup' && <label className={LABEL_CLASS}>Nome
          <input required maxLength={120} autoComplete="name" value={name} onChange={e => setName(e.target.value)} className={INPUT_CLASS} />
        </label>}
        {step === 'signup'
          ? <label className={LABEL_CLASS}>E-mail<input required type="email" maxLength={254} autoComplete="email" autoCapitalize="none" spellCheck={false} value={email} onChange={e => setEmail(e.target.value)} className={INPUT_CLASS} /></label>
          : <input type="hidden" value={email} />}
        {step === 'signup' ? <>
          <label className={LABEL_CLASS}>Senha (mínimo 10 caracteres)
            <PasswordInput required minLength={10} maxLength={1024} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className={INPUT_CLASS} />
          </label>
          <label className={LABEL_CLASS}>Confirmar senha
            <PasswordInput required minLength={10} maxLength={1024} autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} className={INPUT_CLASS} />
          </label>
        </> : <label className={LABEL_CLASS}>Código de confirmação
          <OneTimeCodeInput value={code} onChange={setCode} />
        </label>}
        <button type="submit" className={buttonClass}>{busy ? 'Aguarde…' : step === 'signup' ? 'Cadastrar' : 'Confirmar e-mail'}</button>
      </fieldset>
    </form>}
    {step === 'sent' && <div className="grid gap-3">
      <button type="button" disabled={busy} onClick={() => { setMessage(''); setStep('verify') }} className={buttonClass}>Avançar para informar o código</button>
      <button type="button" disabled={busy} onClick={() => void resend()} className="min-h-10 text-sm font-semibold text-[#317455]">Reenviar código</button>
    </div>}
    {step === 'verify' && <button type="button" disabled={busy} onClick={() => void resend()} className="min-h-10 text-sm font-semibold text-[#317455]">Reenviar código</button>}
    {(step === 'sent' || step === 'verify') && <button type="button" disabled={busy} onClick={() => { setStep('resume'); setCode(''); setError(''); setMessage('') }} className="min-h-10 text-sm font-semibold text-[#317455]">Conferir e-mail</button>}
    {step === 'signup' && <button type="button" disabled={busy} onClick={() => { setStep('resume'); setError(''); setMessage('') }} className="min-h-10 text-sm font-semibold text-[#317455]">Já me cadastrei, confirmar e-mail</button>}
    <button type="button" disabled={busy} onClick={onBack} className="min-h-12 text-sm font-semibold text-[#317455]">Voltar para entrar</button>
  </section>
}
