import { FiX } from 'react-icons/fi'
import { useEffect, useId, useRef, type ReactNode } from 'react'

type Props = { title: string; busy?: boolean; onClose: () => void; children: ReactNode }

export default function FormModal({ title, busy = false, onClose, children }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const element = dialog.current
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    element?.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      element?.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
    }
  }, [])
  return (
    <dialog
      ref={dialog}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-32px)] w-[min(640px,calc(100vw-24px))] overflow-y-auto overscroll-contain rounded-[20px] border border-[#dce8e1] bg-[#f9fbfa] p-[22px] text-[#234c37] shadow-[0_22px_70px_rgba(0,0,0,0.25)] backdrop:bg-[#0b1e17]/65 max-[480px]:p-4"
      aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); if (!busy) onClose() }}
    >
      <header className="flex items-center justify-between gap-4 pb-2">
        <h2 className="m-0 font-['Manrope',sans-serif] text-xl font-bold tracking-tight text-[#143f31]" id={titleId}>
          {title}
        </h2>
        <button
          type="button"
          aria-label="Fechar janela"
          disabled={busy}
          onClick={onClose}
          className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-[#e1eee5] text-[#23573d] transition hover:bg-[#d2e4d7] disabled:opacity-55"
        >
          <FiX size={20} aria-hidden="true" />
        </button>
      </header>
      {children}
    </dialog>
  )
}
