import { useState } from 'react'
import FormModal from './FormModal'
import ConfirmDialog from './ConfirmDialog'
import PasswordInput from './PasswordInput'
import { api, ApiError, errorMessage, INPUT_CLASS, LABEL_CLASS } from './types'

type Account = { id: number; username: string; active: boolean }
export default function PontoAccounts({ token, onUnauthorized }: { token: string; onUnauthorized: () => void }) {
  const [open, setOpen] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [resetAccount, setResetAccount] = useState<Account | null>(null)
  const [toggleAccount, setToggleAccount] = useState<Account | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [success, setSuccess] = useState('')
  function fail(err: unknown) {
    if (err instanceof ApiError && err.status === 401) onUnauthorized()
    else setError(errorMessage(err))
  }
  async function load() {
    setBusy(true); setError('')
    try { setAccounts(await api<Account[]>('/ponto-users', undefined, token)) }
    catch (err) { fail(err) }
    finally { setBusy(false) }
  }
  async function create(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setSuccess('')
    try {
      const account = await api<Account>('/ponto-users', { username, password }, token)
      setAccounts(current => [...current, account].sort((a, b) => a.username.localeCompare(b.username)))
      setUsername(''); setPassword(''); setSuccess(`Conta ${account.username} criada. Entre com ela para abrir o painel de ponto.`)
    } catch (err) { fail(err) }
    finally { setBusy(false) }
  }
  async function changeStatus() {
    if (!toggleAccount) return
    setBusy(true); setError(''); setSuccess('')
    try {
      const result = await api<{ active: boolean }>(`/ponto-users/${toggleAccount.id}/status`, { active: !toggleAccount.active }, token)
      setAccounts(current => current.map(account => account.id === toggleAccount.id ? { ...account, active: result.active } : account))
      setSuccess(result.active ? 'Conta reativada.' : 'Conta desativada e sessões encerradas.')
      setToggleAccount(null)
    } catch (err) { fail(err); setToggleAccount(null) }
    finally { setBusy(false) }
  }
  async function resetPassword(event: React.FormEvent) {
    event.preventDefault()
    if (!resetAccount) return
    setBusy(true); setError(''); setSuccess('')
    try {
      await api(`/ponto-users/${resetAccount.id}/password`, { password: newPassword }, token)
      setSuccess(`Senha de ${resetAccount.username} redefinida. Entre novamente no terminal.`)
      setResetAccount(null); setNewPassword('')
    } catch (err) { fail(err); setResetAccount(null); setNewPassword('') }
    finally { setBusy(false) }
  }
  return <section className="mb-5 rounded-xl border border-[#dce8e1] p-3">
    <button type="button" aria-expanded={open} className="min-h-12 text-sm font-bold text-[#317455]" onClick={() => { setOpen(!open); if (!open) void load() }}>Cadastrar usuário Ponto</button>
    {toggleAccount && <ConfirmDialog title={toggleAccount.active ? 'Desativar conta Ponto?' : 'Reativar conta Ponto?'} message={toggleAccount.active ? `Os terminais conectados como ${toggleAccount.username} perderão o acesso.` : `A conta ${toggleAccount.username} poderá entrar novamente.`} confirmLabel={toggleAccount.active ? 'Desativar' : 'Reativar'} danger={toggleAccount.active} busy={busy} onConfirm={() => void changeStatus()} onCancel={() => setToggleAccount(null)} />}
    {resetAccount && <FormModal title={`Redefinir senha de ${resetAccount.username}`} busy={busy} onClose={() => { setResetAccount(null); setNewPassword('') }}>
      <form onSubmit={resetPassword} className="grid gap-4">
        <p className="text-sm text-[#527566]">Os terminais conectados precisarão entrar novamente com a nova senha.</p>
        <label className={LABEL_CLASS}>Nova senha<PasswordInput required minLength={10} maxLength={1024} value={newPassword} onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" className={INPUT_CLASS} /></label>
        <button disabled={busy} className="min-h-12 rounded-xl bg-[#cef1d6] p-3 font-bold text-[#173d2f]">Redefinir senha</button>
      </form>
    </FormModal>}
    {open && <div className="grid gap-3">
      <p className="text-sm text-[#527566]">Esta conta abre somente o batedor de ponto. Os funcionários continuam usando seus PINs para registrar as batidas.</p>
      <form onSubmit={create}>
        <fieldset disabled={busy} className="grid gap-3">
          <label className={LABEL_CLASS}>Usuário Ponto<input required maxLength={120} autoComplete="off" autoCapitalize="none" spellCheck={false} value={username} onChange={e => setUsername(e.target.value)} className={INPUT_CLASS} /></label>
          <label className={LABEL_CLASS}>Senha<PasswordInput required minLength={10} maxLength={1024} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className={INPUT_CLASS} /></label>
          <p className="text-xs text-[#527566]">Use pelo menos 10 caracteres na senha.</p>
          <button type="submit" className="min-h-12 rounded-xl bg-[#cef1d6] px-4 font-bold text-[#173d2f] disabled:opacity-55" disabled={busy}>{busy ? 'Aguarde…' : 'Criar conta Ponto'}</button>
        </fieldset>
      </form>
      {error && <p role="alert" className="text-sm text-[#913939]">{error}</p>}
      {success && <p role="status" className="text-sm text-[#317455]">{success}</p>}
      <h3 className="text-sm font-bold text-[#143f31]">Contas Ponto cadastradas</h3>
      {accounts.map(account => <div key={account.id} className="rounded-xl bg-[#eaf5ee] p-3 text-sm text-[#143f31]">
        <p className="break-all font-bold">{account.username}</p>
        <p className="mt-1 text-xs">{account.active ? 'Ativa' : 'Desativada'}</p>
        <div className="mt-2 flex flex-wrap gap-3">
          <button type="button" disabled={busy} onClick={() => { setResetAccount(account); setNewPassword('') }} className="min-h-11 font-semibold underline">Redefinir senha</button>
          <button type="button" disabled={busy} onClick={() => setToggleAccount(account)} className="min-h-11 font-semibold underline">{account.active ? 'Desativar' : 'Reativar'}</button>
        </div>
      </div>)}
      {!busy && !error && !accounts.length && <p className="text-sm text-[#527566]">Nenhuma conta Ponto cadastrada.</p>}
      <button type="button" disabled={busy} onClick={() => void load()} className="min-h-10 text-sm font-semibold text-[#317455]">Atualizar contas</button>
    </div>}
  </section>
}
