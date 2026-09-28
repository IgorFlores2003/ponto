import { useEffect, useRef, useState } from 'react'
import { FiBell, FiChevronLeft, FiChevronRight, FiRefreshCw } from 'react-icons/fi'
import FormModal from './FormModal'
import PunchPhotoModal from './PunchPhotoModal'
import DivergenceBadge from './DivergenceBadge'
import { api, ApiError, errorMessage, timestamp, type Employee, type Entry } from './types'

type Alert = Pick<Entry, 'id' | 'employee_id' | 'kind' | 'break_name' | 'occurred_at' | 'divergence_status' | 'divergence_reason'> & { employee_name: string }
type Alerts = { total: number; page: number; page_size: number; rows: Alert[] }
type Detail = { entry: Entry; employee: Employee }
type Props = { token: string; version: number; onUnauthorized: () => void; onEntryUpdated: (entry: Entry) => void }

export default function EntryNotifications({ token, version, onUnauthorized, onEntryUpdated }: Props) {
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [data, setData] = useState<Alerts | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detailError, setDetailError] = useState('')
  const [opening, setOpening] = useState<number | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const selection = useRef(0)
  const unauthorized = useRef(onUnauthorized)
  unauthorized.current = onUnauthorized

  useEffect(() => () => { selection.current++ }, [])
  useEffect(() => {
    let active = true, fetching = false
    setLoading(true)
    async function refresh() {
      if (fetching) return
      fetching = true
      try {
        const result = await api<Alerts>(`/entry-alerts?page=${page}`, undefined, token)
        if (!active) return
        const lastPage = Math.max(1, Math.ceil(result.total / result.page_size))
        if (page > lastPage) setPage(lastPage)
        setData(result); setError('')
      } catch (err) {
        if (active) {
          if (err instanceof ApiError && err.status === 401) unauthorized.current()
          else setError(errorMessage(err))
        }
      } finally {
        fetching = false
        if (active) setLoading(false)
      }
    }
    void refresh()
    const timer = window.setInterval(() => { if (!document.hidden) void refresh() }, 10000)
    const resume = () => { if (!document.hidden) void refresh() }
    document.addEventListener('visibilitychange', resume)
    return () => { active = false; clearInterval(timer); document.removeEventListener('visibilitychange', resume) }
  }, [token, page, version, revision])

  async function inspect(id: number) {
    const current = ++selection.current
    setOpening(id); setDetailError('')
    try {
      const result = await api<Detail>(`/entries/${id}`, undefined, token)
      if (current === selection.current) setDetail(result)
    } catch (err) {
      if (current === selection.current) {
        if (err instanceof ApiError && err.status === 401) unauthorized.current()
        else setDetailError(errorMessage(err))
      }
    } finally {
      if (current === selection.current) setOpening(null)
    }
  }

  function close() {
    selection.current++; setOpening(null); setDetail(null); setOpen(false)
  }

  function reviewed(updated: Entry) {
    if (updated.admin_confirmed || ['confirmed', 'rejected'].includes(updated.divergence_status || '')) {
      setData(current => current ? { ...current, total: Math.max(0, current.total - (current.rows.some(row => row.id === updated.id) ? 1 : 0)), rows: current.rows.filter(row => row.id !== updated.id) } : current)
    }
    setDetail(null)
    setRevision(value => value + 1)
    onEntryUpdated(updated)
  }

  const count = data?.total ?? 0
  const label = error ? 'Notificações: falha ao atualizar' : loading && !data ? 'Carregando notificações' : `Notificações: ${count} batidas aguardando conferência`
  return (
    <>
      <button type="button" aria-label={label} title={label} aria-haspopup="dialog" aria-expanded={open}
        className="relative grid size-11 shrink-0 place-items-center rounded-xl bg-[#e1f3e7] text-[#23573d] transition hover:bg-[#d0ebd8] focus-visible:outline-2 focus-visible:outline-[#246841]"
        onClick={() => { setOpen(true); setDetailError(''); setRevision(value => value + 1) }}>
        <FiBell size={21} aria-hidden="true" />
        {(count > 0 || error) && <span aria-hidden="true" className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[#b6382c] px-1 text-center text-[10px] font-bold leading-5 text-white">{error ? '!' : count > 99 ? '99+' : count}</span>}
      </button>
      {open && !detail && (
        <FormModal title="Notificações de batidas" onClose={close}>
          <p className="mb-3 text-xs leading-relaxed text-[#527566]">Fotos com possível divergência ou sem rosto, aguardando conferência. Inclui todos os funcionários e datas, independentemente dos filtros do relatório. Os alertas são atualizados a cada 10 segundos.</p>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#527566]">
            <span>{data ? `${count} pendentes` : 'Consultando notificações…'}</span>
            <button type="button" disabled={loading} onClick={() => setRevision(value => value + 1)} className="flex min-h-10 items-center gap-1 font-bold text-[#317455] disabled:opacity-50"><FiRefreshCw aria-hidden="true" /> Atualizar</button>
          </div>
          {error && <p role="alert" className="mb-3 rounded-lg bg-[#fff0f0] p-3 text-xs text-[#913939]">{error} A lista pode estar desatualizada. Use Atualizar para tentar novamente.</p>}
          {detailError && <p role="alert" className="mb-3 text-xs text-[#913939]">{detailError}</p>}
          {loading ? <p role="status" className="py-4 text-xs text-[#668174]">Carregando…</p> : data && data.total === 0 && !error ? <p className="py-4 text-sm text-[#315847]">Nenhuma divergência aguardando conferência.</p> : (
            <ul className="grid min-w-0 gap-2">
              {data?.rows.map(entry => (
                <li key={entry.id} className="min-w-0">
                  <button type="button" disabled={opening !== null} onClick={() => void inspect(entry.id)} className="grid w-full min-w-0 gap-1.5 rounded-xl border border-[#e4d6c0] bg-white p-3 text-left [overflow-wrap:anywhere] hover:bg-[#fff8ec] disabled:opacity-60">
                    <strong className="text-sm text-[#143f31]">{entry.employee_name}</strong>
                    <span className="text-xs text-[#527566]">{entry.kind}{entry.break_name ? ` · ${entry.break_name}` : ''} · {timestamp(entry.occurred_at)}</span>
                    <div><DivergenceBadge entry={entry} /></div>
                    {entry.divergence_reason && <span className="text-xs text-[#815b1c]">{entry.divergence_reason}</span>}
                    <span className="text-xs font-bold text-[#317455]">{opening === entry.id ? 'Abrindo foto…' : 'Conferir foto e batida'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {data && data.total > data.page_size && <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
            <button type="button" disabled={loading || page <= 1} onClick={() => setPage(value => value - 1)} className="flex min-h-10 items-center gap-1 font-bold disabled:opacity-40"><FiChevronLeft aria-hidden="true" /> Anterior</button>
            <span>Página {page} de {Math.ceil(data.total / data.page_size)}</span>
            <button type="button" disabled={loading || page * data.page_size >= data.total} onClick={() => setPage(value => value + 1)} className="flex min-h-10 items-center gap-1 font-bold disabled:opacity-40">Próxima <FiChevronRight aria-hidden="true" /></button>
          </div>}
        </FormModal>
      )}
      {open && detail && <PunchPhotoModal entry={detail.entry} employee={detail.employee} token={token} onClose={() => setDetail(null)} onConfirmed={reviewed} />}
    </>
  )
}
