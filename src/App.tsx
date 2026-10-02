import { useCallback, useEffect, useState } from 'react'
import ErrorBoundary from './ErrorBoundary'
import AdminLogin, { loadSavedToken } from './AdminLogin'
import AdminPanel from './AdminPanel'
import TerminalAccess from './TerminalAccess'

type View = 'login' | 'terminal' | 'admin'

function AccessFlow({ notificationTarget, onView }: { notificationTarget: HTMLDivElement | null; onView: (view: View) => void }) {
  const [token, setToken] = useState<string | null>(loadSavedToken)
  const [credentials, setCredentials] = useState<{ username: string; password: string; remember: boolean } | null>(null)
  const [view, setView] = useState<View>(() => loadSavedToken() ? 'terminal' : 'login')

  function exitAdmin() {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_token_expires')
    setToken(null)
    setCredentials(null)
    setView('login')
    onView('login')
  }

  useEffect(() => { onView(view) }, [view, onView])

  if (view === 'admin' && token) return <AdminPanel token={token} onExit={() => { setView('terminal'); onView('terminal') }} onUnauthorized={exitAdmin} notificationTarget={notificationTarget} />
  if (view === 'terminal' && token) return <TerminalAccess credentials={credentials} onCredentialsConsumed={() => setCredentials(null)} onAdmin={() => { setView('admin'); onView('admin') }} />
  return <AdminLogin onLogin={(newToken, authCredentials) => { setToken(newToken); setCredentials(authCredentials); setView('terminal'); onView('terminal') }} />
}

// ─── Shell principal: roteamento por hash ─────────────────────────────────────

export default function App() {
  const [view, setView] = useState<View>('login')
  const [notificationTarget, setNotificationTarget] = useState<HTMLDivElement | null>(null)
  const setCurrentView = useCallback((next: View) => setView(next), [])

  return (
    <main className={`min-h-dvh bg-[#e9f0ec] bg-[radial-gradient(circle_at_15%_0%,#f7fbf8,transparent_35%)] px-2.5 pt-[max(10px,env(safe-area-inset-top))] pb-[max(10px,env(safe-area-inset-bottom))] ${view === 'admin' ? 'sm:px-4 sm:py-7' : ''}`}>
      <div className={`relative mx-auto rounded-[34px] border border-[#dce8e1] bg-[#f9fbfa] shadow-[0_22px_70px_rgba(155,183,167,0.25)] p-5 sm:p-7 ${view === 'admin' ? 'max-w-[860px] sm:px-6 sm:pt-6 pb-[calc(116px+env(safe-area-inset-bottom))]' : 'max-w-[460px]'}`}>
        <header className="mb-6 flex items-center gap-3">
          <img src="/icon-admin.png?v=3" alt="Ponto Digital" className="size-[42px] rounded-[13px] object-cover shadow-sm" />
          <div className="min-w-0">
            <span className="mb-1 block text-[10px] font-bold tracking-[0.14em] text-[#789185]">PONTO DIGITAL</span>
            <div className="flex items-center gap-3">
              <h1 className="min-w-0 font-['Manrope',sans-serif] text-lg font-extrabold text-[#143f31]">
                {view === 'admin' ? 'Área administrativa' : view === 'login' ? 'Acesso à empresa' : 'Terminal de ponto'}
              </h1>
              {view === 'admin' && <div ref={setNotificationTarget} className="shrink-0" />}
            </div>
          </div>
        </header>

        <ErrorBoundary fallbackLabel="Erro ao acessar o aplicativo. Tente recarregar."><AccessFlow notificationTarget={notificationTarget} onView={setCurrentView} /></ErrorBoundary>
      </div>
    </main>
  )
}
