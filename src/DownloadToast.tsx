import { FiCheck, FiAlertCircle, FiX } from 'react-icons/fi'

export type DownloadNotice = {
  type: 'success' | 'error'
  filename?: string
}

interface Props {
  notice: DownloadNotice
  onClose: () => void
}

/** Toast fixo exibido após download/compartilhamento de relatório. */
export default function DownloadToast({ notice, onClose }: Props) {
  const success = notice.type === 'success'
  return (
    <div
      className="fixed bottom-[calc(96px+env(safe-area-inset-bottom))] left-1/2 z-[9999] flex w-[calc(100%-32px)] max-w-[390px] -translate-x-1/2 items-center gap-3 rounded-2xl border border-[#143f31]/12 bg-white px-4 py-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.12)]"
      role="status"
    >
      <div className={`flex size-[38px] min-w-[38px] items-center justify-center rounded-full text-xl font-bold text-white ${success ? 'bg-[#143f31]' : 'bg-[#a43b3b]'}`}>
        {success ? <FiCheck size={20} aria-hidden="true" /> : <FiAlertCircle size={20} aria-hidden="true" />}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <strong className={`text-sm font-bold ${success ? 'text-[#143f31]' : 'text-[#a43b3b]'}`}>
          {success ? 'Relatório baixado' : 'Erro ao exportar'}
        </strong>
        <span className="text-[13px] text-[#59665f]">
          {success
            ? 'Arquivo salvo no celular e pronto para abrir.'
            : 'Não foi possível baixar ou abrir o relatório.'}
        </span>
        {notice.filename && (
          <small className="mt-0.75 truncate text-[11px] text-[#8a948f]">{notice.filename}</small>
        )}
      </div>

      <button
        type="button"
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-transparent p-0 text-[#758079] transition hover:bg-[#f0f3f1]"
        onClick={onClose}
        aria-label="Fechar"
      >
        <FiX size={20} aria-hidden="true" />
      </button>
    </div>
  )
}
