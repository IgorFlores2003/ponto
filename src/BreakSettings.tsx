import { useEffect, useState } from 'react'
import { FiCoffee, FiPlus, FiEdit2, FiTrash2, FiRefreshCw } from 'react-icons/fi'
import ConfirmDialog from './ConfirmDialog'

type Rule = { id: number; name: string; starts_at: string; ends_at: string; effective_from: string; active: boolean }
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

export default function BreakSettings({ request, onError }: { request: <T>(path: string, body?: unknown) => Promise<T>; onError: (error: unknown) => void }) {
  const [rules, setRules] = useState<Rule[]>([])
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState<number | null>(null)
  const [deleteRule, setDeleteRule] = useState<Rule | null>(null)
  const [form, setForm] = useState({ name: '', starts_at: '', ends_at: '', effective_from: today() })

  const inputClass = "min-w-0 w-full rounded-xl border border-[#cbded2] bg-white p-3 text-sm text-[#315847] focus-visible:outline-2 focus-visible:outline-[#31835b]"
  const labelClass = "grid gap-1.5 text-xs font-bold text-[#527566]"

  async function load() { try { setRules(await request<Rule[]>('/break-rules')); setLoaded(true) } catch (err) { onError(err) } }
  useEffect(() => { void load() }, [])

  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setNotice('')
    try {
      await request(editing ? `/break-rules/${editing}` : '/break-rules', form)
      setForm({ name: '', starts_at: '', ends_at: '', effective_from: today() })
      setEditing(null)
      await load()
      setNotice(editing ? 'Pausa atualizada.' : 'Pausa cadastrada. Será identificada nas novas batidas a partir da vigência.')
    }
    catch (err) { onError(err) } finally { setBusy(false) }
  }

  async function deactivate() {
    if (!deleteRule) return
    setBusy(true)
    try { await request(`/break-rules/${deleteRule.id}/delete`, {}); setDeleteRule(null); await load(); setNotice('Pausa excluída. O histórico foi preservado.') }
    catch (err) { onError(err) } finally { setBusy(false) }
  }

  return (
    <section>
      {deleteRule && (
        <ConfirmDialog
          title="Excluir pausa?"
          message={`Excluir ${deleteRule.name}? As batidas antigas continuarão preservadas.`}
          confirmLabel="Excluir pausa"
          danger
          busy={busy}
          onConfirm={() => void deactivate()}
          onCancel={() => setDeleteRule(null)}
        />
      )}
      <div className="flex items-center gap-2">
        <FiCoffee size={20} className="text-[#143f31]" aria-hidden="true" />
        <h2 className="font-['Manrope',sans-serif] text-xl font-bold tracking-tight text-[#143f31]">Pausas da equipe</h2>
      </div>
      <p className="mt-2 mb-5 text-[13px] leading-relaxed text-[#527566]">
        Cadastre os horários das pausas para café. A faixa indica quando a batida pode iniciar essa pausa; o retorno acontece quando o funcionário bater o PIN novamente.
      </p>

      <form className="mb-6 grid gap-3.5 sm:grid-cols-2" onSubmit={save}>
        <label className={labelClass}>
          Nome da pausa
          <input required maxLength={80} placeholder="Ex.: Café da manhã" value={form.name} className={inputClass} onChange={e => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className={labelClass}>
          Válida a partir de
          <input required type="date" min={today()} value={form.effective_from} className={inputClass} onChange={e => setForm({ ...form, effective_from: e.target.value })} />
        </label>
        <label className={labelClass}>
          Faixa de início: de
          <input required type="time" value={form.starts_at} className={inputClass} onChange={e => setForm({ ...form, starts_at: e.target.value })} />
        </label>
        <label className={labelClass}>
          Até (não incluído)
          <input required type="time" value={form.ends_at} className={inputClass} onChange={e => setForm({ ...form, ends_at: e.target.value })} />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-[13px] bg-[#cef1d6] p-3.5 font-bold text-[#173d2f] transition hover:bg-[#e1f9e6] disabled:opacity-55"
            disabled={busy}
          >
            <FiPlus size={18} aria-hidden="true" />
            {editing ? 'Salvar alterações' : 'Cadastrar pausa'}
          </button>
        </div>
      </form>

      {notice && (
        <div className="my-5 rounded-2xl bg-[#e1f3e7] p-4 text-[13px] text-[#195235]" role="status">
          {notice}
        </div>
      )}

      <p className="mt-3 mb-5 text-[13px] leading-relaxed text-[#527566]">
        Horário de Brasília. As faixas não podem se sobrepor. Para mudar uma pausa, desative a antiga e cadastre a nova. Batidas antigas mantêm o nome original.
      </p>

      {!loaded && (
        <button
          type="button"
          className="flex items-center gap-1.5 bg-transparent text-[11px] font-bold text-[#317455] hover:text-[#174b31]"
          onClick={load}
        >
          <FiRefreshCw size={13} aria-hidden="true" />
          Carregar pausas
        </button>
      )}

      {loaded && rules.length === 0 && (
        <p className="px-1 py-4 text-xs text-[#668174]">
          Nenhuma pausa cadastrada. Defina as faixas reais de almoço e café da sua equipe.
        </p>
      )}

      {rules.map(rule => (
        <article className="flex items-center justify-between gap-3 border-t border-[#e2ebe5] py-4" key={rule.id}>
          <div className="min-w-0">
            <strong className="text-sm font-semibold text-[#143f31]">{rule.name}</strong>
            <p className="mt-1 text-xs text-[#789185]">
              {rule.starts_at}–{rule.ends_at} · a partir de {rule.effective_from.split('-').reverse().join('/')}
            </p>
            <p className="mt-0.5 text-xs text-[#789185]">
              {!rule.active ? 'Excluída' : rule.effective_from > today() ? 'Agendada' : 'Ativa'}
            </p>
          </div>
          {rule.active && (
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                className="flex items-center gap-1 bg-transparent text-[11px] font-bold text-[#317455] hover:text-[#174b31] disabled:opacity-55"
                disabled={busy}
                onClick={() => { setEditing(rule.id); setForm({ name: rule.name, starts_at: rule.starts_at, ends_at: rule.ends_at, effective_from: rule.effective_from }) }}
              >
                <FiEdit2 size={13} aria-hidden="true" />
                Editar
              </button>
              <button
                type="button"
                className="flex items-center gap-1 bg-transparent text-[11px] font-bold text-[#a24636] hover:text-[#7f2d20] disabled:opacity-55"
                disabled={busy}
                onClick={() => setDeleteRule(rule)}
              >
                <FiTrash2 size={13} aria-hidden="true" />
                Excluir
              </button>
            </div>
          )}
        </article>
      ))}
    </section>
  )
}

