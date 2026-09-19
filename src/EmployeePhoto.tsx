import { useRef, useState } from 'react'
export function Avatar({ name, photo }: { name: string; photo?: string | null }) {
  return photo ? <img className="employee-avatar" src={photo} alt={`Foto de ${name}`} /> : <span className="employee-avatar avatar-placeholder" aria-hidden="true">{name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase() || '?'}</span>
}
export default function EmployeePhoto({ name, photo, onChange, disabled = false, onBusyChange }: { onBusyChange?: (busy: boolean) => void; name: string; photo?: string | null; onChange: (photo: string | null) => Promise<void> | void; disabled?: boolean }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const sequence = useRef(0)
  async function choose(file?: File) {
    if (!file) return
    setError(''); setBusy(true); onBusyChange?.(true)
    const current = ++sequence.current
    let url = ''
    try {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Escolha uma foto JPG, PNG ou WebP.')
      if (file.size > 10 * 1024 * 1024) throw new Error('Escolha uma foto de até 10 MB.')
      url = URL.createObjectURL(file)
      const image = new Image(); image.src = url; await image.decode()
      const scale = Math.min(1, 320 / Math.max(image.naturalWidth, image.naturalHeight))
      const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Não foi possível preparar a foto.')
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
      if (current === sequence.current) await onChange(canvas.toDataURL('image/jpeg', 0.8))
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar a foto.') }
    finally { if (url) URL.revokeObjectURL(url); setBusy(false); onBusyChange?.(false) }
  }
  return <div className="photo-editor"><Avatar name={name} photo={photo} /><div><label className="photo-label">{busy ? 'Salvando foto…' : 'Escolher foto'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled || busy} onChange={e => { void choose(e.target.files?.[0]); e.target.value = '' }} /></label>{photo && <button type="button" className="text-button" disabled={disabled || busy} onClick={async () => { setBusy(true); setError(''); try { await onChange(null) } catch { setError('Não foi possível remover a foto.') } finally { setBusy(false) } }}>Remover foto</button>}</div>{error && <p role="alert" className="photo-error">{error}</p>}</div>
}
