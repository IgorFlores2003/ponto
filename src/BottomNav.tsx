import { createPortal } from 'react-dom'
import type { IconType } from 'react-icons'
import { FiGrid, FiCalendar, FiUsers, FiFileText } from 'react-icons/fi'

export type AdminTab = 'dashboard' | 'calendario' | 'funcionarios' | 'relatorios'
const items: { key: AdminTab; label: string; icon: IconType }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: FiGrid },
  { key: 'calendario', label: 'Calendário', icon: FiCalendar },
  { key: 'funcionarios', label: 'Funcionários', icon: FiUsers },
  { key: 'relatorios', label: 'Relatórios', icon: FiFileText }
]
export default function BottomNav({ active, onChange }: { active: AdminTab; onChange: (tab: AdminTab) => void }) {
  return createPortal(
    <nav className="fixed bottom-0 left-1/2 z-[900] grid w-full max-w-[860px] -translate-x-1/2 grid-cols-4 gap-1 rounded-t-[20px] border border-b-0 border-[#cbded2] bg-[#f9fbfa] px-2 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))] shadow-[0_-6px_24px_#173e311a]" aria-label="Navegação administrativa">
      {items.map(({ key, label, icon: Icon }) => <button key={key} type="button" aria-current={active === key ? 'page' : undefined} className={`flex min-h-15 min-w-0 flex-col items-center justify-center gap-1.25 rounded-xl text-[11px] font-bold focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-[#215ca0] ${active === key ? 'bg-[#174b31] text-white' : 'bg-transparent text-[#527566]'}`} onClick={() => onChange(key)}>
        <Icon size={18} className="size-[18px] shrink-0" aria-hidden="true" />
        <span className="text-[11px] leading-[14px]">{label}</span>
      </button>)}
    </nav>, document.body
  )
}
