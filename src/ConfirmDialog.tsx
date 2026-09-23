import { useEffect } from 'react'

type Props = { title: string; message: string; confirmLabel: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onCancel: () => void }

export default function ConfirmDialog({ title, message, confirmLabel, danger = false, busy = false, onConfirm, onCancel }: Props) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onCancel() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, onCancel])
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onCancel() }}>
    <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message">
      <h2 id="confirm-dialog-title">{title}</h2><p id="confirm-dialog-message">{message}</p>
      <div className="confirm-dialog-actions"><button type="button" className="secondary-button" disabled={busy} onClick={onCancel}>Cancelar</button><button type="button" className={danger ? 'danger-confirm-button' : 'primary-button'} disabled={busy} onClick={onConfirm}>{busy ? 'Aguarde…' : confirmLabel}</button></div>
    </section>
  </div>
}
