import { useEffect, useState } from 'react'
type Rule = { id: number; name: string; starts_at: string; ends_at: string; effective_from: string; active: boolean }
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
export default function BreakSettings({ request, onError }: { request: <T>(path: string, body?: unknown) => Promise<T>; onError: (error: unknown) => void }) {
  const [rules, setRules] = useState<Rule[]>([])
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState({ name: '', starts_at: '', ends_at: '', effective_from: today() })
  async function load() { try { setRules(await request<Rule[]>('/break-rules')); setLoaded(true) } catch (err) { onError(err) } }
  useEffect(() => { void load() }, [])
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setNotice('')
    try { await request('/break-rules', form); setForm({ name: '', starts_at: '', ends_at: '', effective_from: today() }); await load(); setNotice('Pausa cadastrada. Será identificada nas novas batidas a partir da vigência.') }
    catch (err) { onError(err) } finally { setBusy(false) }
  }
  async function deactivate(id: number) {
    setBusy(true)
    try { await request(`/break-rules/${id}/deactivate`, {}); await load(); setNotice('Pausa desativada. O histórico foi preservado.') }
    catch (err) { onError(err) } finally { setBusy(false) }
  }
  return <section><h2>Pausas da equipe</h2><p className="break-explanation">Cadastre almoço, café da tarde ou outras pausas. A faixa indica quando a batida pode iniciar essa pausa; o retorno acontece quando o funcionário bater o PIN novamente.</p>
    <form className="settings-form employee-form" onSubmit={save}><label>Nome da pausa<input required maxLength={80} placeholder="Ex.: Café da manhã" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label><label>Válida a partir de<input required type="date" min={today()} value={form.effective_from} onChange={e => setForm({ ...form, effective_from: e.target.value })} /></label><label>Faixa de início: de<input required type="time" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} /></label><label>Até (não incluído)<input required type="time" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} /></label><button className="primary-button" disabled={busy}>Cadastrar pausa</button></form>
    {notice && <p className="receipt" role="status">{notice}</p>}
    <p className="break-explanation">Horário de Brasília. As faixas não podem se sobrepor. Para mudar uma pausa, desative a antiga e cadastre a nova. Batidas antigas mantêm o nome original.</p>
    {!loaded && <button className="text-button" onClick={load}>Carregar pausas</button>}
    {loaded && rules.length === 0 && <p className="empty">Nenhuma pausa cadastrada. Defina as faixas reais de almoço e café da sua equipe.</p>}
    {rules.map(rule => <article className="employee-card" key={rule.id}><div><strong>{rule.name}</strong><p>{rule.starts_at}–{rule.ends_at} · a partir de {rule.effective_from.split('-').reverse().join('/')}</p><p>{!rule.active ? 'Desativada' : rule.effective_from > today() ? 'Agendada' : 'Ativa'}</p></div>{rule.active && <button className="text-button" disabled={busy} onClick={() => deactivate(rule.id)}>Desativar</button>}</article>)}
  </section>
}
