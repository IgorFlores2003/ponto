import { useCallback, useEffect, useState } from 'react'
import ErrorBoundary from './ErrorBoundary'
import { loadSavedToken } from './AdminLogin'
import AdminSignup from './AdminSignup'
import PasswordRecovery from './PasswordRecovery'
import AdminPanel from './AdminPanel'
import TerminalAccess, { logoutTerminalSession } from './TerminalAccess'

type View = 'terminal' | 'admin-login' | 'admin-signup' | 'admin-recovery' | 'admin'

function AccessFlow({ notificationTarget, onView }: { notificationTarget: HTMLDivElement | null; onView: (view: View) => void }) {
  const [adminToken, setAdminToken] = useState<string | null>(loadSavedToken)
  const [view, setView] = useState<View>(() => loadSavedToken() ? 'admin' : 'terminal')

  function clearAdminToken() {
    sessionStorage.removeItem('admin_token')
    sessionStorage.removeItem('admin_token_expires')
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_token_expires')
    setAdminToken(null)
  }

  async function logoutAccount() {
    clearAdminToken()
    await logoutTerminalSession()
    setView('terminal')
    onView('terminal')
  }

  useEffect(() => { onView(view) }, [view, onView])

  if (view === 'admin' && adminToken) return <AdminPanel token={adminToken} onLogout={() => void logoutAccount()} onUnauthorized={() => { clearAdminToken(); setView('terminal') }} notificationTarget={notificationTarget} />
  if (view === 'admin-signup') return <AdminSignup onBack={() => setView('terminal')} />
  if (view === 'admin-recovery') return <PasswordRecovery onBack={() => setView('terminal')} />
  return <TerminalAccess onAdmin={token => { setAdminToken(token); setView('admin') }} onCreateAccount={() => setView('admin-signup')} onForgotPassword={() => setView('admin-recovery')} />
}

// Shell principal: acesso definido pelo perfil autenticado.

export default function App() {
  const [view, setView] = useState<View>('terminal')
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
                {view === 'admin' ? 'Área administrativa' : view === 'admin-login' || view === 'admin-signup' || view === 'admin-recovery' ? 'Acesso administrativo' : 'Terminal de ponto'}
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
