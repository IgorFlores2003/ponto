import { FiEye, FiEyeOff } from 'react-icons/fi'
import { useEffect, useId, useState, type ComponentPropsWithRef } from 'react'

type Props = Omit<ComponentPropsWithRef<'input'>, 'type'>

export default function PasswordInput({ id, value, disabled, className = '', ...props }: Props) {
  const generatedId = useId()
  const inputId = id || generatedId
  const [visible, setVisible] = useState(false)
  const isPin = props.inputMode === 'numeric'
  const label = `${visible ? 'Ocultar' : 'Mostrar'} ${isPin ? 'PIN' : 'senha'}`
  useEffect(() => { if (!value || disabled) setVisible(false) }, [value, disabled])

  return (
    <span className="relative block min-w-0 w-full">
      <input
        {...props}
        id={inputId}
        value={value}
        disabled={disabled}
        type={visible ? 'text' : 'password'}
        className={`w-full pr-12 ${className}`}
      />
      <button
        type="button"
        className="absolute top-1/2 right-1 grid h-9 w-10 -translate-y-1/2 place-items-center rounded-lg bg-transparent text-[#315847] transition hover:bg-[#eaf1ed] disabled:opacity-55"
        aria-label={label}
        title={label}
        aria-controls={inputId}
        aria-pressed={visible}
        disabled={disabled}
        onClick={() => setVisible(current => !current)}
      >
        {visible ? <FiEyeOff size={20} aria-hidden="true" /> : <FiEye size={20} aria-hidden="true" />}
      </button>
    </span>
  )
}
