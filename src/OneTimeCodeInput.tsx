type Props = { value: string; onChange: (value: string) => void }

export default function OneTimeCodeInput({ value, onChange }: Props) {
  return <div className="grid gap-2">
    <input
      aria-label="Código de confirmação"
      required
      type="text"
      inputMode="numeric"
      pattern="[0-9]{6,10}"
      maxLength={10}
      autoComplete="one-time-code"
      placeholder="Código completo do e-mail"
      value={value}
      onChange={event => onChange(event.target.value.replace(/\D/g, '').slice(0, 10))}
      className="min-h-12 w-full min-w-0 rounded-xl border border-[#b8cec0] bg-white px-3 text-lg font-bold tracking-widest text-[#173d2f] outline-none placeholder:text-sm placeholder:font-normal placeholder:tracking-normal focus:ring-2 focus:ring-[#71a98b]"
    />
    <span className="text-xs font-normal text-[#527566]">Digite todos os números do código recebido, inclusive se tiver 8 dígitos.</span>
  </div>
}
