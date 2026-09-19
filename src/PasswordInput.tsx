import { useEffect, useId, useState, type ComponentPropsWithRef } from 'react'

type Props = Omit<ComponentPropsWithRef<'input'>, 'type'>

export default function PasswordInput({ id, value, disabled, ...props }: Props) {
  const generatedId = useId()
  const inputId = id || generatedId
  const [visible, setVisible] = useState(false)
  const isPin = props.inputMode === 'numeric'
  const label = `${visible ? 'Ocultar' : 'Mostrar'} ${isPin ? 'PIN' : 'senha'}`
  useEffect(() => { if (!value || disabled) setVisible(false) }, [value, disabled])

  return <span className="password-field">
    <input {...props} id={inputId} value={value} disabled={disabled} type={visible ? 'text' : 'password'} />
    <button type="button" className="password-toggle" aria-label={label} title={label} aria-controls={inputId} aria-pressed={visible} disabled={disabled} onClick={() => setVisible(current => !current)}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
        {visible && <path d="m3 3 18 18" />}
      </svg>
    </button>
  </span>
}
