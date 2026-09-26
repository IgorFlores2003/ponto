import { FiAlertTriangle, FiAlertCircle, FiCheckCircle, FiCheck, FiClock, FiXCircle } from 'react-icons/fi'
import type { Entry } from './types'

interface Props {
  entry: Entry
}

/**
 * Badge de status para conferência biométrica / detecção facial da batida.
 */
export default function DivergenceBadge({ entry }: Props) {
  if (entry.divergence_status === 'rejected') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-[#fee2e2] px-2 py-0.5 text-[10px] font-bold text-[#b91c1c]"
        title="Foto marcada como errada pelo administrador"
      >
        <FiXCircle size={10} aria-hidden="true" /> Foto errada
      </span>
    )
  }

  if (entry.admin_confirmed || entry.divergence_status === 'confirmed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#dcfce7] px-2 py-0.5 text-[10px] font-bold text-[#166534]">
        <FiCheckCircle size={10} aria-hidden="true" /> Validada
      </span>
    )
  }

  if (entry.divergence_status === 'divergence') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-[#fef3c7] px-2 py-0.5 text-[10px] font-bold text-[#92400e]"
        title={entry.divergence_reason || undefined}
      >
        <FiAlertTriangle size={10} aria-hidden="true" /> Sugestão de divergência
      </span>
    )
  }

  if (entry.divergence_status === 'no_face') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-[#fee2e2] px-2 py-0.5 text-[10px] font-bold text-[#991b1b]"
        title={entry.divergence_reason || undefined}
      >
        <FiAlertCircle size={10} aria-hidden="true" /> Sem rosto
      </span>
    )
  }

  if (entry.divergence_status === 'ok') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#f0fdf4] px-2 py-0.5 text-[10px] font-semibold text-[#15803d]">
        <FiCheck size={10} aria-hidden="true" /> Rosto OK
      </span>
    )
  }

  if (entry.divergence_status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#f3f4f6] px-2 py-0.5 text-[10px] font-medium text-[#4b5563]">
        <FiClock size={10} aria-hidden="true" /> Analisando…
      </span>
    )
  }

  return null
}
