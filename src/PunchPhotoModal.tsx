import { useState } from 'react'
import { FiX, FiCheckCircle, FiAlertTriangle, FiAlertCircle, FiCheck, FiClock } from 'react-icons/fi'
import { api, timestamp, type Employee, type Entry } from './types'

interface Props {
  entry: Entry
  employee?: Employee
  token?: string
  onClose: () => void
  onConfirmed?: (updated: Entry) => void
}

/**
 * Modal para visualização da foto da batida com comparação biométrica e confirmação do gestor.
 */
export default function PunchPhotoModal({
  entry,
  employee,
  token,
  onClose,
  onConfirmed,
}: Props) {
  const [currentEntry, setCurrentEntry] = useState(entry)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')

  const title = `${currentEntry.kind}${currentEntry.break_name ? ` · ${currentEntry.break_name}` : ''}`
  const time = timestamp(currentEntry.occurred_at)

  async function handleConfirm() {
    if (!token) return
    setConfirming(true)
    setError('')
    try {
      const updated = await api<Entry>(`/entries/${currentEntry.id}/confirm`, {}, token)
      const merged: Entry = {
        ...currentEntry,
        admin_confirmed: true,
        admin_confirmed_at: updated?.admin_confirmed_at || new Date().toISOString(),
        divergence_status: 'confirmed',
      }
      setCurrentEntry(merged)
      onConfirmed?.(merged)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao confirmar batida.')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#edf0ee] pb-3">
          <div>
            <h4 className="text-sm font-bold text-[#143f31]">{title}</h4>
            <p className="text-[11px] text-[#82958b]">
              {employee?.name} · {time}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#527566] transition hover:bg-[#edf0ee]"
            aria-label="Fechar"
          >
            <FiX size={18} />
          </button>
        </div>

        {/* Comparação de Fotos */}
        {employee?.photo ? (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <span className="mb-1 block text-center text-[11px] font-bold text-[#315847]">
                Foto na batida
              </span>
              <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-[#cbded2] bg-neutral-900 shadow-inner">
                <img
                  src={currentEntry.punch_photo!}
                  alt="Foto na batida"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
            <div>
              <span className="mb-1 block text-center text-[11px] font-bold text-[#315847]">
                Foto cadastrada
              </span>
              <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-[#cbded2] bg-neutral-900 shadow-inner">
                <img
                  src={employee.photo}
                  alt="Foto cadastrada do funcionário"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex max-h-[320px] items-center justify-center overflow-hidden rounded-xl border border-[#cbded2] bg-neutral-900">
            <img
              src={currentEntry.punch_photo!}
              alt={`Foto da batida ${title}`}
              className="max-h-[320px] w-full object-contain"
            />
          </div>
        )}

        {/* Status e sugestão da IA */}
        {currentEntry.divergence_status === 'divergence' && !currentEntry.admin_confirmed && (
          <div className="mt-3.5 rounded-xl border border-[#f59e0b]/40 bg-[#fffbeb] p-3 text-xs text-[#92400e]">
            <div className="flex items-center gap-1.5 font-bold">
              <FiAlertTriangle size={15} /> Sugestão de possível divergência
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-[#78350f]">
              {currentEntry.divergence_reason || 'A imagem registrada pode pertencer a outra pessoa ou apresentar inconsistência facial.'}
            </p>
          </div>
        )}

        {currentEntry.divergence_status === 'no_face' && !currentEntry.admin_confirmed && (
          <div className="mt-3.5 rounded-xl border border-[#f87171]/40 bg-[#fef2f2] p-3 text-xs text-[#991b1b]">
            <div className="flex items-center gap-1.5 font-bold">
              <FiAlertCircle size={15} /> Nenhum rosto humano identificado
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-[#7f1d1d]">
              {currentEntry.divergence_reason || 'A câmera pode ter sido coberta ou apontada para outro local.'}
            </p>
          </div>
        )}

        {(currentEntry.admin_confirmed || currentEntry.divergence_status === 'confirmed') && (
          <div className="mt-3.5 rounded-xl border border-[#86efac]/50 bg-[#f0fdf4] p-3 text-center text-xs font-bold text-[#166534]">
            <div className="flex items-center justify-center gap-1.5">
              <FiCheckCircle size={16} /> Confirmado pelo administrador
            </div>
            {currentEntry.admin_confirmed_at && (
              <span className="mt-0.5 block text-[10px] font-normal text-[#15803d]">
                Validado em {timestamp(currentEntry.admin_confirmed_at)}
              </span>
            )}
          </div>
        )}

        {currentEntry.divergence_status === 'ok' && !currentEntry.admin_confirmed && (
          <div className="mt-3.5 rounded-xl border border-[#86efac]/40 bg-[#f0fdf4] p-2.5 text-center text-xs font-semibold text-[#166534]">
            <FiCheck size={14} className="mr-1 inline" /> Rosto identificado e validado
          </div>
        )}

        {currentEntry.divergence_status === 'pending' && !currentEntry.admin_confirmed && (
          <div className="mt-3.5 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-2.5 text-center text-xs font-semibold text-[#4b5563]">
            <FiClock size={14} className="mr-1 inline" /> Análise biométrica da IA em processamento…
          </div>
        )}

        {error && (
          <p className="mt-2 text-center text-xs text-[#b91c1c]">{error}</p>
        )}

        {/* Ações do Administrador */}
        <div className="mt-4 grid gap-2">
          {token && !currentEntry.admin_confirmed && currentEntry.divergence_status !== 'confirmed' && (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={confirming}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#1e5944] py-2.5 text-xs font-bold text-white transition hover:bg-[#143f31] disabled:opacity-50"
            >
              <FiCheckCircle size={15} />
              {confirming ? 'Confirmando…' : 'Administrador confirma batida'}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-[#f0f4f1] py-2.5 text-xs font-bold text-[#315847] transition hover:bg-[#e4ede6]"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
