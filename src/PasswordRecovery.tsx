import { useState } from 'react'
import PasswordInput from './PasswordInput'
import { api, errorMessage, INPUT_CLASS, LABEL_CLASS } from './types'

export default function PasswordRecovery({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<'email' | 'reset' | 'done'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  async function send(event?: React.FormEvent) {
    event?.preventDefault(); setError(''); setMessage('')
    if (step === 'reset' && password !== confirm) { setError('As senhas precisam ser iguais.'); return }
    setBusy(true)
    try {
      const result = await api<{ message: string }>(step === 'email' ? '/auth/forgot-password' : '/auth/reset-password', step === 'email' ? { email } : { email, code, password })
      setMessage(result.message); setStep(step === 'email' ? 'reset' : 'done'); setPassword(''); setConfirm('')
    } catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }
  return <section className="grid gap-4 py-2">
    <h2 className="text-xl font-bold text-[#143f31]">Recuperar senha</h2>
    <p className="text-sm text-[#527566]">{step === 'email' ? 'Informe o e-mail usado no cadastro. Enviaremos um código para você definir uma nova senha.' : step === 'reset' ? 'Confira sua caixa de entrada e a pasta de spam. Digite o código e escolha sua nova senha.' : 'Sua senha foi alterada. Volte para entrar.'}</p>
    {step !== 'done' && <form onSubmit={send}><fieldset disabled={busy} className="grid gap-4">
      <label className={LABEL_CLASS}>E-mail<input required type="email" maxLength={254} autoComplete="email" autoCapitalize="none" value={email} onChange={e => setEmail(e.target.value)} className={INPUT_CLASS} /></label>
      {step === 'reset' && <>
        <label className={LABEL_CLASS}>Código recebido<input required inputMode="numeric" pattern="[0-9]{6,10}" maxLength={10} autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} className={INPUT_CLASS} /></label>
        <label className={LABEL_CLASS}>Nova senha<PasswordInput required minLength={10} maxLength={1024} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className={INPUT_CLASS} /></label>
        <label className={LABEL_CLASS}>Confirmar nova senha<PasswordInput required minLength={10} maxLength={1024} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} className={INPUT_CLASS} /></label>
      </>}
      <button className="min-h-12 rounded-xl bg-[#cef1d6] p-3 font-bold text-[#173d2f]">{busy ? 'Aguarde…' : step === 'email' ? 'Enviar código' : 'Salvar nova senha'}</button>
    </fieldset></form>}
    {message && <p role="status" className="text-sm text-[#234c37]">{message}</p>}
    {error && <p role="alert" className="text-sm text-[#913939]">{error}</p>}
    {step === 'email' && <button type="button" disabled={busy} onClick={() => setStep('reset')} className="min-h-12 text-sm font-bold text-[#317455]">Já recebi o código</button>}
    {step === 'reset' && <button type="button" disabled={busy} onClick={() => { setStep('email'); setPassword(''); setConfirm(''); setCode(''); setMessage(''); setError('') }} className="min-h-12 text-sm font-bold text-[#317455]">Solicitar outro código</button>}
    <button type="button" disabled={busy} onClick={onBack} className="min-h-12 text-sm font-bold text-[#317455]">Voltar para entrar</button>
  </section>
}
