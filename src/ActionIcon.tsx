import { FiLogIn, FiLogOut, FiRotateCcw, FiCoffee, FiPause } from 'react-icons/fi'
import { LuUtensils } from 'react-icons/lu'

export default function ActionIcon({ kind, breakName }: { kind: string; breakName?: string | null }) {
  const arrival = kind === 'Entrada' || kind === 'Entrada do almoço'
  const departure = kind === 'Saída' || kind === 'Saída do almoço'
  const pause = kind === 'Início do intervalo'
  const Icon = arrival ? FiLogIn : departure ? FiLogOut : !pause ? FiRotateCcw : /caf[eé]/i.test(breakName || '') ? FiCoffee : /almo[cç]o|jantar|refei[cç]/i.test(breakName || '') ? LuUtensils : FiPause
  const color = arrival ? 'bg-[#e1f3e7] text-[#246841]' : departure ? 'bg-[#fbe9e3] text-[#a24636]' : pause ? 'bg-[#fff0d7] text-[#8b5a18]' : 'bg-[#e7effb] text-[#315c99]'
  return <span className={`inline-grid size-[38px] shrink-0 place-items-center rounded-[11px] ${color}`} aria-hidden="true"><Icon size={23} className="size-[23px]" /></span>
}
