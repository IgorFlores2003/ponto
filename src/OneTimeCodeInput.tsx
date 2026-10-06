type Props = { value: string; onChange: (value: string) => void }

export default function OneTimeCodeInput({ value, onChange }: Props) {
  return <div className="relative grid grid-cols-6 gap-2 rounded-xl focus-within:ring-2 focus-within:ring-[#71a98b]">
    {Array.from({ length: Math.max(6, value.length) }, (_, index) => <span key={index} aria-hidden="true" className="flex aspect-square min-w-0 items-center justify-center rounded-lg border border-[#b8cec0] bg-white text-xl font-bold text-[#173d2f]">
      {value[index] || ''}
    </span>)}
    <input
      aria-label="Código de confirmação"
      required
      inputMode="numeric"
      pattern="[0-9]{6,10}"
      maxLength={10}
      autoComplete="one-time-code"
      value={value}
      onChange={event => onChange(event.target.value.replace(/\D/g, '').slice(0, 10))}
      className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
    />
  </div>
}
