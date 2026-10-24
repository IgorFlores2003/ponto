import { useState } from 'react'
import PasswordInput from './PasswordInput'
import { api, errorMessage, INPUT_CLASS, LABEL_CLASS } from './types'
import type { AdminSession } from './adminSession'

export default function ChangePassword({ token, onChanged }: { token: string; onChanged: (session: AdminSession) => void }) {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setMessage('')
    if (password !== confirm) { setError('As senhas precisam ser iguais.'); return }
    setBusy(true)
    try {
      const result = await api<AdminSession & { message: string }>('/auth/change-password', { current_password: current, password }, token)
      setOpen(false); setCurrent(''); setPassword(''); setConfirm(''); setMessage(result.message)
      onChanged(result)
    }
    catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }
  return <section className="mb-5 rounded-xl border border-[#dce8e1] p-3">
    <button type="button" disabled={busy} aria-expanded={open} onClick={() => { setOpen(!open); setCurrent(''); setPassword(''); setConfirm(''); setError(''); setMessage('') }} className="min-h-12 text-sm font-bold text-[#317455]">Mudar minha senha</button>
    {message && <p role="status" className="text-sm text-[#234c37]">{message}</p>}
    {open && <form onSubmit={submit}><fieldset disabled={busy} className="grid gap-3">
      <p className="text-sm text-[#527566]">Você continua conectado neste aparelho. As outras sessões desta conta serão encerradas.</p>
      <label className={LABEL_CLASS}>Senha atual<PasswordInput required autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} className={INPUT_CLASS} /></label>
      <label className={LABEL_CLASS}>Nova senha (mínimo 10 caracteres)<PasswordInput required minLength={10} maxLength={1024} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className={INPUT_CLASS} /></label>
      <label className={LABEL_CLASS}>Confirmar nova senha<PasswordInput required minLength={10} maxLength={1024} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} className={INPUT_CLASS} /></label>
      {error && <p role="alert" className="text-sm text-[#913939]">{error}</p>}
      <button className="min-h-12 rounded-xl bg-[#cef1d6] p-3 font-bold text-[#173d2f]">{busy ? 'Salvando…' : 'Salvar nova senha'}</button>
    </fieldset></form>}
  </section>
}
