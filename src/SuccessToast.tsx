import { FiCheck, FiX } from 'react-icons/fi'
import { useEffect } from 'react'

export default function SuccessToast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(onClose, 5000)
    return () => window.clearTimeout(timer)
  }, [message, onClose])
  return (
    <div
      className="fixed bottom-[calc(96px+env(safe-area-inset-bottom))] left-1/2 z-[2000] flex w-max max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-3 rounded-[14px] bg-[#174b31] px-4 py-3 text-white shadow-[0_8px_30px_rgba(0,0,0,0.2)]"
      role="status"
      aria-live="polite"
    >
      <FiCheck size={20} className="shrink-0 text-[#9fe6ba]" aria-hidden="true" />
      <p className="m-0 text-sm font-medium leading-snug">{message}</p>
      <button
        type="button"
        aria-label="Fechar aviso de sucesso"
        onClick={onClose}
        className="grid size-8 shrink-0 place-items-center rounded-lg bg-transparent text-white/80 transition hover:bg-white/10 hover:text-white"
      >
        <FiX size={18} aria-hidden="true" />
      </button>
    </div>
  )
}

