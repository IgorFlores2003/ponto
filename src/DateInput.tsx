import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react'
import { formatDate } from './types'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'min' | 'max'> & {
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
}

function parseDate(text: string) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(text)) return ''
  const [day, month, year] = text.split('/')
  const iso = `${year}-${month}-${day}`
  const date = new Date(`${iso}T12:00:00Z`)
  return Number(year) > 0 && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : ''
}

/** Mantém o dia antes do mês, independentemente do idioma do navegador. */
export default function DateInput({ value, onChange, min, max, ...props }: Props) {
  const [text, setText] = useState(() => formatDate(value))
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => { setText(formatDate(value)) }, [value])
  useEffect(() => {
    const date = parseDate(text)
    const message = text && !date ? 'Informe uma data válida no formato DD/MM/AAAA.'
      : date && min && date < min ? `Informe uma data a partir de ${formatDate(min)}.`
      : date && max && date > max ? `Informe uma data até ${formatDate(max)}.` : ''
    input.current?.setCustomValidity(message)
  }, [text, min, max])

  return <input {...props} ref={input} type="text" lang="pt-BR" inputMode="numeric"
    placeholder="DD/MM/AAAA" maxLength={10} value={text}
    onChange={event => {
      const digits = event.target.value.replace(/\D/g, '').slice(0, 8)
      const formatted = digits.slice(0, 2) + (digits.length > 2 ? `/${digits.slice(2, 4)}` : '') + (digits.length > 4 ? `/${digits.slice(4)}` : '')
      setText(formatted)
      const date = parseDate(formatted)
      if (date || !formatted) onChange(date)
    }} />
}
