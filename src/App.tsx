import { useEffect, useState } from 'react'
import ErrorBoundary from './ErrorBoundary'
import AdminLogin, { loadSavedToken } from './AdminLogin'
import AdminPanel from './AdminPanel'
import TerminalAccess from './TerminalAccess'

// ─── Componente Admin: gerencia token (login <-> painel) ──────────────────────

function Admin({ notificationTarget }: { notificationTarget: HTMLDivElement | null }) {
  const [token, setToken] = useState<string | null>(loadSavedToken)

  function exitAdmin() {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_token_expires')
    setToken(null)
  }

  if (token) {
    return <AdminPanel token={token} onExit={exitAdmin} notificationTarget={notificationTarget} />
  }

  return <AdminLogin onLogin={setToken} />
}

// ─── Shell principal: roteamento por hash ─────────────────────────────────────

export default function App() {
  const [admin, setAdmin] = useState(() => location.hash.startsWith('#/admin'))
  const [notificationTarget, setNotificationTarget] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    const onChange = () => setAdmin(location.hash.startsWith('#/admin'))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  return (
    <main className={`min-h-screen bg-[#e9f0ec] bg-[radial-gradient(circle_at_15%_0%,#f7fbf8,transparent_35%)] px-4 py-7 ${admin ? '' : 'min-h-dvh px-2.5 pt-[max(10px,env(safe-area-inset-top))] pb-[max(10px,env(safe-area-inset-bottom))]'}`}>
      <div className={`relative mx-auto rounded-[34px] border border-[#dce8e1] bg-[#f9fbfa] shadow-[0_22px_70px_rgba(155,183,167,0.25)] ${admin ? 'max-w-[860px] p-4 sm:px-6 sm:pt-6 pb-[calc(116px+env(safe-area-inset-bottom))]' : 'max-w-[460px] p-5 sm:p-7'}`}>
        <header className="mb-6 flex items-center gap-3">
          <img src="/icon-admin.png?v=3" alt="Ponto Digital" className="size-[42px] rounded-[13px] object-cover shadow-sm" />
          <div className="min-w-0">
            <span className="mb-1 block text-[10px] font-bold tracking-[0.14em] text-[#789185]">PONTO DIGITAL</span>
            <div className="flex items-center gap-3">
              <h1 className="min-w-0 font-['Manrope',sans-serif] text-lg font-extrabold text-[#143f31]">
                {admin ? 'Área administrativa' : 'Terminal de ponto'}
              </h1>
              {admin && <div ref={setNotificationTarget} className="shrink-0" />}
            </div>
          </div>
        </header>

        {admin
          ? <ErrorBoundary fallbackLabel="Erro na área administrativa. Tente recarregar."><Admin notificationTarget={notificationTarget} /></ErrorBoundary>
          : <ErrorBoundary fallbackLabel="Erro no terminal de ponto. Tente recarregar."><TerminalAccess /></ErrorBoundary>}
      </div>
    </main>
  )
}
