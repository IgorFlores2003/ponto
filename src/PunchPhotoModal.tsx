import { useState, useEffect } from 'react'
import { FiCheckCircle, FiAlertTriangle, FiAlertCircle, FiCheck, FiClock, FiXCircle } from 'react-icons/fi'
import FormModal from './FormModal'
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

  // Mantém currentEntry sincronizado se a batida for atualizada em background
  useEffect(() => {
    setCurrentEntry(entry)
  }, [entry])

  // Se a análise ainda estiver pendente, dispara imediatamente para não deixar aguardando
  useEffect(() => {
    if (token && currentEntry.divergence_status === 'pending' && currentEntry.punch_photo) {
      api<Entry>(`/entries/${currentEntry.id}/analyze`, {}, token)
        .then(updated => {
          if (updated && updated.divergence_status !== 'pending') {
            setCurrentEntry(updated)
            onConfirmed?.(updated)
          }
        })
        .catch(() => {})
    }
  }, [currentEntry.id, currentEntry.divergence_status, currentEntry.punch_photo, token])

  const title = `${currentEntry.kind}${currentEntry.break_name ? ` · ${currentEntry.break_name}` : ''}`
  const time = timestamp(currentEntry.occurred_at)

  async function handleConfirm() {
    if (!token) return
    setConfirming(true)
    setError('')
    try {
      const updated = await api<Entry>(`/entries/${currentEntry.id}/confirm`, { status: 'confirmed' }, token)
      const merged: Entry = {
        ...currentEntry,
        admin_confirmed: true,
        admin_confirmed_at: updated?.admin_confirmed_at || new Date().toISOString(),
        divergence_status: 'confirmed',
      }
      onConfirmed?.(merged)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao validar batida.')
    } finally {
      setConfirming(false)
    }
  }

  async function handleReject() {
    if (!token) return
    setConfirming(true)
    setError('')
    try {
      let updated: Entry | null = null
      try {
        updated = await api<Entry>(`/entries/${currentEntry.id}/reject`, {}, token)
      } catch {
        updated = await api<Entry>(`/entries/${currentEntry.id}/confirm`, { status: 'rejected' }, token)
      }
      const merged: Entry = {
        ...currentEntry,
        admin_confirmed: true,
        admin_confirmed_at: updated?.admin_confirmed_at || new Date().toISOString(),
        divergence_status: 'rejected',
      }
      onConfirmed?.(merged)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao marcar foto como errada.')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <FormModal title="Conferir foto da batida" busy={confirming} onClose={onClose}>
      <div className="min-w-0 [overflow-wrap:anywhere]">
        <div className="border-b border-[#edf0ee] pb-3">
          <h4 className="text-sm font-bold text-[#143f31]">{title}</h4>
          <p className="text-[11px] text-[#82958b]">{employee?.name} · {time}</p>
        </div>

        {/* Comparação de Fotos - Imagens inteiras sem corte */}
        {!currentEntry.punch_photo ? (
          <p className="mt-4 rounded-xl bg-[#fff0f0] p-3 text-xs text-[#913939]">Foto da batida indisponível. Confira os dados do registro antes de decidir.</p>
        ) : employee?.photo ? (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <span className="mb-1 block text-center text-[11px] font-bold text-[#315847]">
                Foto na batida
              </span>
              <div className="flex h-56 sm:h-64 w-full items-center justify-center overflow-hidden rounded-xl border border-[#cbded2] bg-neutral-950 p-1 shadow-inner">
                <img
                  src={currentEntry.punch_photo!}
                  alt="Foto na batida"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            </div>
            <div>
              <span className="mb-1 block text-center text-[11px] font-bold text-[#315847]">
                Foto cadastrada
              </span>
              <div className="flex h-56 sm:h-64 w-full items-center justify-center overflow-hidden rounded-xl border border-[#cbded2] bg-neutral-950 p-1 shadow-inner">
                <img
                  src={employee.photo}
                  alt="Foto cadastrada do funcionário"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex h-64 sm:h-80 w-full items-center justify-center overflow-hidden rounded-xl border border-[#cbded2] bg-neutral-950 p-1">
            <img
              src={currentEntry.punch_photo!}
              alt={`Foto da batida ${title}`}
              className="max-h-full max-w-full object-contain"
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

        {currentEntry.divergence_status !== 'rejected' && (currentEntry.admin_confirmed || currentEntry.divergence_status === 'confirmed') && (
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

        {currentEntry.divergence_status === 'rejected' && (
          <div className="mt-3.5 rounded-xl border border-[#f87171]/50 bg-[#fef2f2] p-3 text-center text-xs font-bold text-[#b91c1c]">
            <div className="flex items-center justify-center gap-1.5">
              <FiXCircle size={16} /> Foto marcada como errada pelo administrador
            </div>
            {currentEntry.admin_confirmed_at && (
              <span className="mt-0.5 block text-[10px] font-normal text-[#991b1b]">
                Registrado em {timestamp(currentEntry.admin_confirmed_at)}
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

        {/* Ações do Administrador - Somente solicita confirmação em casos de divergência */}
        <div className="mt-4 grid gap-2">
          {token &&
            (currentEntry.divergence_status === 'divergence' || currentEntry.divergence_status === 'no_face') &&
            !currentEntry.admin_confirmed && (
              <>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={confirming}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#1e5944] py-2.5 text-xs font-bold text-white transition hover:bg-[#143f31] disabled:opacity-50"
                >
                  <FiCheckCircle size={15} />
                  {confirming ? 'Confirmando…' : 'Validar batida mesmo com divergência'}
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={confirming}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#fca5a5] bg-[#fef2f2] py-2.5 text-xs font-bold text-[#b91c1c] transition hover:bg-[#fee2e2] disabled:opacity-50"
                >
                  <FiXCircle size={15} />
                  {confirming ? 'Processando…' : 'Marcar como foto errada'}
                </button>
              </>
            )}

          <button
            type="button"
            onClick={onClose}
            disabled={confirming}
            className="w-full rounded-xl bg-[#f0f4f1] py-2.5 text-xs font-bold text-[#315847] transition hover:bg-[#e4ede6]"
          >
            Fechar
          </button>
        </div>
      </div>
    </FormModal>
  )
}
