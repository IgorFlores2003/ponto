import { useState } from 'react'
import { FiFilter, FiRotateCcw } from 'react-icons/fi'
import FormModal from './FormModal'
import type { DashboardRow } from './Dashboard'

export type DashboardFilters = { name: string; employeeId: string; job: string; status: string; from: string; to: string }

export default function DashboardFiltersModal({ filters, rows, onApply, onClose }: { filters: DashboardFilters; rows: DashboardRow[]; onApply: (filters: DashboardFilters) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(filters)
  const jobs = [...new Set(rows.map(row => row.job_title).filter(Boolean))].sort((a, b) => a.localeCompare(b))

  const inputClass = "min-w-0 w-full rounded-xl border border-[#cbded2] bg-white p-3 text-sm text-[#315847] focus-visible:outline-2 focus-visible:outline-[#31835b]"
  const labelClass = "grid gap-1.5 text-xs font-bold text-[#527566]"

  return (
    <FormModal title="Filtros do dashboard" onClose={onClose}>
      <form
        className="mt-5 mb-2.5 grid grid-cols-2 items-end gap-3.5 max-[420px]:grid-cols-1"
        onSubmit={event => { event.preventDefault(); onApply(draft) }}
      >
        <label className={labelClass}>
          De
          <input required type="date" max={draft.to} value={draft.from} className={inputClass} onChange={event => setDraft({ ...draft, from: event.target.value })} />
        </label>
        <label className={labelClass}>
          Até
          <input required type="date" min={draft.from} max={draft.from ? new Date(Date.parse(`${draft.from}T12:00:00Z`) + 366 * 86400000).toISOString().slice(0, 10) : undefined} value={draft.to} className={inputClass} onChange={event => setDraft({ ...draft, to: event.target.value })} />
        </label>
        <label className={labelClass}>
          Nome, função ou matrícula
          <input type="search" placeholder="Digite para filtrar" value={draft.name} className={inputClass} onChange={event => setDraft({ ...draft, name: event.target.value })} />
        </label>
        <label className={labelClass}>
          Funcionário
          <select value={draft.employeeId} className={inputClass} onChange={event => setDraft({ ...draft, employeeId: event.target.value })}>
            <option value="">Todos os funcionários</option>
            {rows.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>
        </label>
        <label className={labelClass}>
          Função
          <select value={draft.job} className={inputClass} onChange={event => setDraft({ ...draft, job: event.target.value })}>
            <option value="">Todas as funções</option>
            <option value="__empty">Sem função definida</option>
            {jobs.map(job => <option key={job}>{job}</option>)}
          </select>
        </label>
        <label className={labelClass}>
          Situação
          <select value={draft.status} className={inputClass} onChange={event => setDraft({ ...draft, status: event.target.value })}>
            <option value="">Todas as situações</option>
            <option value="Em expediente">Em serviço</option>
            <option value="Em intervalo">Em intervalo</option>
            <option value="Fora do expediente">Fora do expediente</option>
          </select>
        </label>

        <div className="col-span-full flex items-center justify-between pt-2">
          <button
            type="button"
            className="flex items-center gap-1.5 bg-transparent text-[11px] font-bold text-[#317455] hover:text-[#174b31]"
            onClick={() => {
              const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
              setDraft({ name: '', employeeId: '', job: '', status: '', from: `${today.slice(0, 7)}-01`, to: today })
            }}
          >
            <FiRotateCcw size={13} aria-hidden="true" />
            Limpar filtros
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="bg-transparent px-3 py-2 text-[13px] font-bold text-[#527566] hover:text-[#173d2f]"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-[13px] bg-[#cef1d6] px-5 py-3 text-sm font-bold text-[#173d2f] transition hover:bg-[#e1f9e6]"
            >
              <FiFilter size={15} aria-hidden="true" />
              Aplicar filtros
            </button>
          </div>
        </div>
      </form>
    </FormModal>
  )
}

