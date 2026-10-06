import { useState } from 'react'
import PasswordInput from './PasswordInput'
import OneTimeCodeInput from './OneTimeCodeInput'
import { api, errorMessage, INPUT_CLASS, LABEL_CLASS } from './types'

type Step = 'email' | 'code' | 'password' | 'done'

export default function PasswordRecovery({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function sendCode(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      const result = await api<{ message: string }>('/auth/forgot-password', { email })
      setMessage(result.message)
      setStep('code')
    } catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }

  async function resendCode() {
    setBusy(true); setError(''); setMessage('')
    try { setMessage((await api<{ message: string }>('/auth/forgot-password', { email })).message) }
    catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }

  async function savePassword(event: React.FormEvent) {
    event.preventDefault(); setError(''); setMessage('')
    if (!/^\d{6,10}$/.test(code)) { setError('Informe o código de 6 a 10 números.'); setStep('code'); return }
    if (password !== confirm) { setError('As senhas precisam ser iguais.'); return }
    setBusy(true)
    try {
      const result = await api<{ message: string }>('/auth/reset-password', { email, code, password })
      setMessage(result.message); setStep('done'); setPassword(''); setConfirm('')
    } catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }

  const heading = step === 'email' ? 'Recuperar senha'
    : step === 'code' ? 'Informe o código'
      : step === 'password' ? 'Crie uma nova senha' : 'Senha alterada'
  const description = step === 'email' ? 'Informe o e-mail usado no cadastro. Enviaremos um código para você definir uma nova senha.'
    : step === 'code' ? `Digite o código enviado para ${email}. Confira também a pasta de spam.`
      : step === 'password' ? 'Escolha e confirme sua nova senha.'
        : 'Sua senha foi alterada. Volte para entrar.'

  return <section className="grid gap-4 py-2">
    <h2 className="text-xl font-bold text-[#143f31]">{heading}</h2>
    <p className="text-sm text-[#527566]">{description}</p>

    {step === 'email' && <form onSubmit={sendCode} className="grid gap-4">
      <label className={LABEL_CLASS}>E-mail
        <input required type="email" maxLength={254} autoComplete="email" autoCapitalize="none" value={email} onChange={e => setEmail(e.target.value)} className={INPUT_CLASS} />
      </label>
      <button disabled={busy} className="min-h-12 rounded-xl bg-[#cef1d6] p-3 font-bold text-[#173d2f] disabled:opacity-55">{busy ? 'Aguarde…' : 'Enviar código'}</button>
    </form>}

    {step === 'code' && <div className="grid gap-4">
      <label className="grid gap-2 text-sm font-semibold text-[#234c37]">Código de recuperação
        <OneTimeCodeInput value={code} onChange={setCode} />
      </label>
      <button type="button" disabled={busy || !/^\d{6,10}$/.test(code)} onClick={() => { setError(''); setMessage(''); setStep('password') }} className="min-h-12 rounded-xl bg-[#cef1d6] p-3 font-bold text-[#173d2f] disabled:opacity-55">Continuar</button>
      <button type="button" disabled={busy} onClick={() => void resendCode()} className="min-h-10 text-sm font-bold text-[#317455] disabled:opacity-55">Reenviar código</button>
      <button type="button" disabled={busy} onClick={() => { setStep('email'); setCode(''); setError(''); setMessage('') }} className="min-h-10 text-sm font-bold text-[#317455] disabled:opacity-55">Corrigir e-mail</button>
    </div>}

    {step === 'password' && <form onSubmit={savePassword} className="grid gap-4">
      <label className={LABEL_CLASS}>Nova senha
        <PasswordInput required minLength={10} maxLength={1024} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className={INPUT_CLASS} />
      </label>
      <label className={LABEL_CLASS}>Confirmar nova senha
        <PasswordInput required minLength={10} maxLength={1024} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} className={INPUT_CLASS} />
      </label>
      <button disabled={busy} className="min-h-12 rounded-xl bg-[#cef1d6] p-3 font-bold text-[#173d2f] disabled:opacity-55">{busy ? 'Aguarde…' : 'Salvar nova senha'}</button>
      <button type="button" disabled={busy} onClick={() => { setStep('code'); setError(''); setMessage('') }} className="min-h-10 text-sm font-bold text-[#317455] disabled:opacity-55">Voltar ao código</button>
    </form>}

    {step === 'done' && <button type="button" onClick={onBack} className="min-h-12 rounded-xl bg-[#cef1d6] p-3 font-bold text-[#173d2f]">Voltar para entrar</button>}
    {message && <p role="status" className="rounded-xl bg-[#eaf5ee] p-3 text-sm text-[#234c37]">{message}</p>}
    {error && <p role="alert" className="rounded-xl bg-[#fff0f0] p-3 text-sm text-[#913939]">{error}</p>}
    {step !== 'done' && <button type="button" disabled={busy} onClick={onBack} className="min-h-12 text-sm font-bold text-[#317455] disabled:opacity-55">Voltar para entrar</button>}
  </section>
}
