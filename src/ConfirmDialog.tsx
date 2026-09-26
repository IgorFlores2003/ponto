import { useEffect } from 'react'
import { FiAlertTriangle } from 'react-icons/fi'

type Props = { title: string; message: string; confirmLabel: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onCancel: () => void }

export default function ConfirmDialog({ title, message, confirmLabel, danger = false, busy = false, onConfirm, onCancel }: Props) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onCancel() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, onCancel])
  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-[#0b1e17]/60 backdrop-blur-xs p-5" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onCancel() }}>
      <section className="w-full max-w-[440px] rounded-[18px] bg-white p-6 shadow-[0_22px_70px_rgba(0,0,0,0.25)]" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message">
        <div className="flex items-center gap-3">
          {danger && <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#fbe9e3] text-[#a24636]"><FiAlertTriangle size={20} aria-hidden="true" /></div>}
          <h2 className="font-['Manrope',sans-serif] text-xl font-bold tracking-tight text-[#143f31]" id="confirm-dialog-title">{title}</h2>
        </div>
        <p className="mt-3 mb-[22px] text-sm leading-relaxed text-[#527566]" id="confirm-dialog-message">{message}</p>
        <div className="flex justify-end gap-2.5">
          <button type="button" className="rounded-[10px] bg-[#eaf1ed] px-4 py-2.75 text-[13px] font-bold text-[#315847] transition hover:bg-[#dbe6df] disabled:opacity-55" disabled={busy} onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className={`rounded-[10px] px-4 py-2.75 text-[13px] font-bold transition disabled:opacity-55 ${danger ? 'bg-[#a63c3c] text-white hover:bg-[#bd4545]' : 'bg-[#cef1d6] text-[#173d2f] hover:bg-[#e1f9e6]'}`} disabled={busy} onClick={onConfirm}>
            {busy ? 'Aguarde…' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}

