import { useState } from 'react'
import PasswordInput from './PasswordInput'
import { api, errorMessage, INPUT_CLASS, LABEL_CLASS } from './types'

export default function AdminSignup({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<'signup' | 'verify' | 'done'>('signup')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
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
      const result = await api<{ message: string }>(step === 'signup' ? '/auth/signup' : '/auth/verify-email',
        step === 'signup' ? { name, email, password } : { email, code })
      setMessage(result.message); setPassword(''); setConfirmation('')
      setStep(step === 'signup' ? 'verify' : 'done')
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
    <h2 className="text-xl font-bold text-[#143f31]">{step === 'signup' ? 'Criar conta' : step === 'verify' ? 'Confirmar e-mail' : 'Aguardando aprovação'}</h2>
    <p className="text-sm text-[#527566]">{step === 'signup'
      ? 'Cadastre seu acesso à área administrativa. Você precisará confirmar seu e-mail e receber aprovação de um administrador da empresa.'
      : step === 'verify' ? 'Digite o código recebido por e-mail. Confira também a pasta de spam.'
        : 'Seu cadastro não libera acesso aos dados da empresa até ser aprovado. Depois da aprovação, entre usando seu e-mail e senha.'}</p>
    {step !== 'done' && <form onSubmit={submit}>
      <fieldset disabled={busy} className="grid gap-4">
        {step === 'signup' && <label className={LABEL_CLASS}>Nome
          <input required maxLength={120} autoComplete="name" value={name} onChange={e => setName(e.target.value)} className={INPUT_CLASS} />
        </label>}
        <label className={LABEL_CLASS}>E-mail
          <input required type="email" maxLength={254} autoComplete="email" autoCapitalize="none" spellCheck={false} value={email} onChange={e => setEmail(e.target.value)} className={INPUT_CLASS} />
        </label>
        {step === 'signup' ? <>
          <label className={LABEL_CLASS}>Senha (mínimo 10 caracteres)
            <PasswordInput required minLength={10} maxLength={1024} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className={INPUT_CLASS} />
          </label>
          <label className={LABEL_CLASS}>Confirmar senha
            <PasswordInput required minLength={10} maxLength={1024} autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} className={INPUT_CLASS} />
          </label>
        </> : <label className={LABEL_CLASS}>Código de confirmação
          <input required inputMode="numeric" pattern="[0-9]{6,10}" maxLength={10} autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} className={INPUT_CLASS} />
        </label>}
        <button type="submit" className={buttonClass}>{busy ? 'Aguarde…' : step === 'signup' ? 'Cadastrar' : 'Confirmar e-mail'}</button>
      </fieldset>
    </form>}
    {message && <p role="status" className="rounded-xl bg-[#eaf5ee] p-3 text-sm text-[#234c37]">{message}</p>}
    {error && <p role="alert" className="rounded-xl bg-[#fff0f0] p-3 text-sm text-[#913939]">{error}</p>}
    {step === 'verify' && <button type="button" disabled={busy} onClick={() => void resend()} className={buttonClass}>Reenviar código</button>}
    {step === 'signup' && <button type="button" disabled={busy} onClick={() => { setStep('verify'); setPassword(''); setConfirmation('') }} className="min-h-12 text-sm font-semibold text-[#317455]">Já tenho um código de confirmação</button>}
    <button type="button" disabled={busy} onClick={onBack} className="min-h-12 text-sm font-semibold text-[#317455]">Voltar para entrar</button>
  </section>
}
