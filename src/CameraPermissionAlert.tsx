import { FiCameraOff, FiSettings, FiRefreshCw } from 'react-icons/fi'
import { openDeviceSettings } from './appSettings'
import { requestCameraPermission } from './camera'

interface Props {
  onPermissionResolved?: () => void
}

/**
 * Alerta e ações quando o acesso à câmera está negado/bloqueado.
 * Permite ao colaborador abrir as configurações de permissões do celular diretamente.
 */
export default function CameraPermissionAlert({ onPermissionResolved }: Props) {
  async function handleOpenSettings() {
    const opened = await openDeviceSettings()
    if (!opened) {
      alert(
        'No navegador, clique no ícone de cadeado/configurações ao lado do endereço e autorize o acesso à câmera.',
      )
    }
  }

  async function handleRetry() {
    const granted = await requestCameraPermission()
    if (granted) {
      onPermissionResolved?.()
    }
  }

  return (
    <section
      className="mt-4 rounded-2xl border border-[#f59e0b]/50 bg-[#fffbeb] p-4 text-left text-[#92400e] shadow-md"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-[#fef3c7] p-2 text-[#b45309]">
          <FiCameraOff size={22} aria-hidden="true" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-[#78350f]">Câmera obrigatória para bater ponto</h3>
          <p className="mt-1 text-xs leading-relaxed text-[#92400e]">
            Por segurança, o ponto não pode ser registrado sem a permissão da câmera frontal.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleOpenSettings}
              className="flex items-center gap-1.5 rounded-xl bg-[#b45309] px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#92400e]"
            >
              <FiSettings size={14} aria-hidden="true" />
              Abrir configurações do celular
            </button>
            <button
              type="button"
              onClick={handleRetry}
              className="flex items-center gap-1.5 rounded-xl border border-[#d97706]/40 bg-white px-3 py-2 text-xs font-semibold text-[#78350f] transition hover:bg-[#fef3c7]"
            >
              <FiRefreshCw size={13} aria-hidden="true" />
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
