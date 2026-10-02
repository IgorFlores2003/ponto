import { useState } from 'react'
import { api, errorMessage } from './types'

type Registration = { id: number; name: string; email: string; email_confirmed_at: string | null }
export default function AdminApprovals({ token }: { token: string }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Registration[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function load() {
    setBusy(true); setError('')
    try { setItems(await api<Registration[]>('/admin-registrations', undefined, token)) }
    catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }
  async function review(item: Registration, action: 'approve' | 'reject') {
    if (!window.confirm(action === 'approve' ? `Autorizar ${item.email} a administrar todos os funcionários e registros desta empresa?` : `Recusar o cadastro de ${item.email}?`)) return
    setBusy(true); setError('')
    try {
      await api(`/admin-registrations/${item.id}/review`, { action }, token)
      setItems(current => current.filter(row => row.id !== item.id))
    } catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }
  return <section className="mb-5 rounded-xl border border-[#dce8e1] p-3">
    <button type="button" aria-expanded={open} className="min-h-12 text-sm font-bold text-[#317455]" onClick={() => { setOpen(!open); if (!open) void load() }}>Aprovar novos administradores</button>
    {open && <div className="grid gap-3">
      <p className="text-sm text-[#527566]">A aprovação libera acesso aos dados de toda a empresa. O e-mail precisa estar confirmado.</p>
      <button type="button" disabled={busy} onClick={() => void load()} className="min-h-12 text-sm font-semibold text-[#317455]">{busy ? 'Aguarde…' : 'Atualizar solicitações'}</button>
      {error && <p role="alert" className="text-sm text-[#913939]">{error}</p>}
      {!busy && !error && !items.length && <p className="text-sm text-[#527566]">Nenhum cadastro pendente.</p>}
      {items.map(item => <div key={item.id} className="rounded-xl bg-[#eaf5ee] p-3">
        <p className="font-semibold text-[#143f31]">{item.name}</p><p className="break-all text-sm text-[#527566]">{item.email}</p>
        <p className="my-2 text-xs text-[#527566]">{item.email_confirmed_at ? 'E-mail confirmado' : 'Confirmação de e-mail pendente; será conferida ao aprovar.'}</p>
        <div className="flex gap-3">
          <button type="button" disabled={busy} onClick={() => void review(item, 'approve')} className="min-h-12 rounded-xl bg-[#cef1d6] px-4 font-bold text-[#173d2f] disabled:opacity-55">Aprovar</button>
          <button type="button" disabled={busy} onClick={() => void review(item, 'reject')} className="min-h-12 rounded-xl border border-[#e5b8b8] px-4 font-bold text-[#913939] disabled:opacity-55">Recusar</button>
        </div>
      </div>)}
    </div>}
  </section>
}
