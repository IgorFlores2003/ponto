import { useEffect, useRef, useState } from 'react'
import { FiClock, FiCheck } from 'react-icons/fi'
import PasswordInput from './PasswordInput'
import ActionIcon from './ActionIcon'
import { api, ApiError, errorMessage, timestamp } from './types'

type Receipt = {
  employee_name: string
  kind: string
  break_name?: string | null
  occurred_at: string
}

/** Terminal de ponto: campo de PIN + tipo de batida + comprovante. */
export default function Terminal() {
  const [pin, setPin] = useState('')
  const [kind, setKind] = useState('Entrada')
  const [intervalType, setIntervalType] = useState<'lunch' | 'coffee'>('lunch')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const lock = useRef(false)
  const pending = useRef<string | null>(null)

  useEffect(() => {
    if (!receipt) return
    const timer = setTimeout(() => setReceipt(null), 6000)
    return () => clearTimeout(timer)
  }, [receipt])

  async function punch(event: React.FormEvent) {
    event.preventDefault()
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    setReceipt(null)
    pending.current ||= crypto.randomUUID()
    try {
      setReceipt(
        await api('/terminal/punch', {
          pin,
          kind,
          interval_type: kind === 'start_break' ? intervalType : undefined,
          request_id: pending.current,
        }),
      )
      pending.current = null
      setKind('Entrada')
      setIntervalType('lunch')
    } catch (err) {
      setError(errorMessage(err))
      if (err instanceof ApiError) pending.current = null
    } finally {
      setPin('')
      setBusy(false)
      lock.current = false
      input.current?.blur()
    }
  }

  return (
    <>
      <section className="rounded-[25px] bg-linear-to-br from-[#1e5944] to-[#10382d] p-6 text-center text-[#f7fffa] shadow-[0_15px_26px_rgba(23,75,57,0.25)]">
        <div className="mx-auto mb-3 grid size-14 place-items-center rounded-full border border-[#8fceb1]/60 text-[#bce9c9]">
          <FiClock size={32} aria-hidden="true" />
        </div>
        <span className="mb-1 block text-[10px] font-bold tracking-[0.14em] text-[#a9d6b9]">
          REGISTRE SUA JORNADA
        </span>
        <h2 className="font-['Manrope',sans-serif] text-2xl font-bold tracking-tight text-white">
          Digite seu PIN
        </h2>
        <p className="mx-auto mt-1 max-w-[260px] text-xs leading-normal text-[#c1ddcb]">
          Digite seu PIN e marque o ponto. Use o PIN a cada batida.
        </p>

        <form onSubmit={punch} className="mt-5 grid gap-3 text-left">
          <label htmlFor="terminal-pin" className="text-xs font-semibold text-[#d7f1df]">
            PIN de 4 números
          </label>
          <PasswordInput
            ref={input}
            id="terminal-pin"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            minLength={4}
            required
            autoComplete="off"
            value={pin}
            disabled={busy}
            className="rounded-xl border border-[#8fceb1] bg-white p-3 text-center font-['Manrope',sans-serif] text-3xl font-bold tracking-[0.4em] text-[#143229] focus-visible:outline-2 focus-visible:outline-[#cef1d6]"
            onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
          />

          <label htmlFor="punch-kind" className="text-xs font-semibold text-[#d7f1df]">
            Tipo de batida
          </label>
          <select
            id="punch-kind"
            value={kind}
            disabled={busy}
            className="w-full rounded-xl border border-[#8fceb1]/40 bg-white p-3 text-sm text-[#143229] focus-visible:outline-2 focus-visible:outline-[#cef1d6]"
            onChange={e => { setKind(e.target.value); pending.current = null }}
          >
            <option value="Entrada">Entrar</option>
            <option value="Saída">Sair</option>
            <option value="start_break">Iniciar intervalo</option>
            <option value="end_break">Fim intervalo</option>
          </select>

          {kind === 'start_break' && (
            <>
              <label htmlFor="interval-type" className="text-xs font-semibold text-[#d7f1df]">
                Tipo de intervalo
              </label>
              <select
                id="interval-type"
                value={intervalType}
                disabled={busy}
                className="w-full rounded-xl border border-[#8fceb1]/40 bg-white p-3 text-sm text-[#143229] focus-visible:outline-2 focus-visible:outline-[#cef1d6]"
                onChange={e => { setIntervalType(e.target.value as 'lunch' | 'coffee'); pending.current = null }}
              >
                <option value="lunch">Almoço</option>
                <option value="coffee">Café</option>
              </select>
            </>
          )}

          <button
            type="submit"
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-[13px] bg-[#cef1d6] p-3.5 text-base font-bold text-[#173d2f] transition hover:bg-[#e1f9e6] disabled:opacity-55"
            disabled={busy || pin.length !== 4}
          >
            <FiCheck size={18} aria-hidden="true" />
            {busy ? 'Registrando…' : 'Marcar ponto'}
          </button>
        </form>
        <small className="mt-3 block text-[10px] text-[#a9d6b9]">
          No fim do intervalo, o sistema identifica automaticamente se era almoço ou café.
        </small>
      </section>

      {error && (
        <p className="mt-4 rounded-xl border border-[#e5b8b8] bg-[#fff0f0] p-3 text-[13px] text-[#913939]" role="alert">
          {error}
        </p>
      )}

      {receipt && (
        <section className="my-4 rounded-2xl bg-[#e1f3e7] p-4 text-[#195235]" role="status">
          <div className="flex items-center gap-3">
            <ActionIcon kind={receipt.kind} breakName={receipt.break_name} />
            <h2 className="font-['Manrope',sans-serif] text-lg font-bold text-[#143f31]">
              {receipt.employee_name}
            </h2>
          </div>
          <p className="mt-2 text-xs text-[#246841]">
            {receipt.kind}{receipt.break_name ? ` · ${receipt.break_name}` : ''} registrada
          </p>
          <strong className="mt-1 block text-sm font-bold">{timestamp(receipt.occurred_at)}</strong>
        </section>
      )}

      <p className="mt-6 text-center text-xs text-[#82958b]">
        Horário de Brasília ·{' '}
        <a href="#/admin" className="font-semibold text-[#317455] hover:text-[#173d2f]">
          Acesso do administrador
        </a>
      </p>
    </>
  )
}
