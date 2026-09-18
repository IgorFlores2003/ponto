import { useMemo, useState } from 'react'

type EntryKind = 'Entrada' | 'Saída' | 'Início do intervalo' | 'Fim do intervalo'
type Entry = { id: number; date: string; time: string; kind: EntryKind }

const storedEntries = localStorage.getItem('ponto-entries')
const initialEntries: Entry[] = storedEntries ? JSON.parse(storedEntries) : []
const initialName = localStorage.getItem('ponto-name') || 'Funcionário'
const initialTarget = Number(localStorage.getItem('ponto-target') || 8)

function dateKey(date = new Date()) { return date.toLocaleDateString('pt-BR') }
function formatDate(date = new Date()) { return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(date) }
function formatTime(date = new Date()) { return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date) }
function minutesBetween(start: string, end: string) { const [sh, sm] = start.split(':').map(Number); const [eh, em] = end.split(':').map(Number); return Math.max(0, eh * 60 + em - (sh * 60 + sm)) }
function formatMinutes(total: number) { return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}` }

export default function App() {
  const [entries, setEntries] = useState<Entry[]>(initialEntries)
  const [name, setName] = useState(initialName)
  const [targetHours, setTargetHours] = useState(initialTarget)
  const [activeTab, setActiveTab] = useState<'inicio' | 'historico' | 'configuracoes'>('inicio')
  const [notice, setNotice] = useState('')
  const [historyDate, setHistoryDate] = useState(dateKey())
  const today = dateKey()
  const todayEntries = entries.filter((entry) => entry.date === today)
  const lastEntry = todayEntries[todayEntries.length - 1]
  const isWorking = lastEntry?.kind === 'Entrada' || lastEntry?.kind === 'Fim do intervalo'
  const isOnBreak = lastEntry?.kind === 'Início do intervalo'

  const workedMinutes = useMemo(() => {
    let total = 0
    let start: string | null = null
    for (const entry of todayEntries) {
      if (entry.kind === 'Entrada' || entry.kind === 'Fim do intervalo') start = entry.time
      if ((entry.kind === 'Saída' || entry.kind === 'Início do intervalo') && start) { total += minutesBetween(start, entry.time); start = null }
    }
    return total
  }, [todayEntries])

  const selectedHistory = entries.filter((entry) => entry.date === historyDate).reverse()
  const historyTotal = entries.filter((entry) => entry.date === historyDate).reduce((total, entry, index, dayEntries) => {
    if (entry.kind !== 'Saída' && entry.kind !== 'Início do intervalo') return total
    const previous = dayEntries[index - 1]
    return previous && (previous.kind === 'Entrada' || previous.kind === 'Fim do intervalo') ? total + minutesBetween(previous.time, entry.time) : total
  }, 0)

  function showNotice(message: string) { setNotice(message); window.setTimeout(() => setNotice(''), 3500) }
  function saveEntries(next: Entry[]) { setEntries(next); localStorage.setItem('ponto-entries', JSON.stringify(next)) }
  function register(kind: EntryKind) { const entry = { id: Date.now(), date: today, time: formatTime(), kind }; saveEntries([...entries, entry]); showNotice(`${kind} registrada às ${entry.time}.`) }
  function removeEntry(id: number) { saveEntries(entries.filter((entry) => entry.id !== id)); showNotice('Registro removido.') }
  function saveProfile(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const cleanName = name.trim() || 'Funcionário'; setName(cleanName); localStorage.setItem('ponto-name', cleanName); localStorage.setItem('ponto-target', String(targetHours)); showNotice('Configurações salvas.') }
  function clearAll() { if (!window.confirm('Excluir todos os registros deste aparelho?')) return; saveEntries([]); showNotice('Todos os registros foram excluídos.') }

  return <main className="app-shell"><div className="phone-frame">
    <header className="topbar"><div className="brand-mark">PD</div><div><span className="eyebrow">PONTO DIGITAL</span><h1>Olá, {name}</h1></div><div className="avatar">{name.slice(0, 2).toUpperCase()}</div></header>
    {notice && <div className="toast" role="status"><span>✓</span>{notice}</div>}

    {activeTab === 'inicio' && <>
      <section className="date-row"><div><span className="eyebrow">SEU DIA</span><h2>{formatDate()}</h2></div><span className="status-pill"><i />{isOnBreak ? 'Em intervalo' : isWorking ? 'Em expediente' : 'Fora do expediente'}</span></section>
      <section className="clock-card"><div className="fingerprint"><span>◷</span></div><p className="eyebrow light">CONTROLE DE JORNADA</p><h2>{isOnBreak ? 'Você está no intervalo' : isWorking ? 'Expediente em andamento' : 'Pronto para começar?'}</h2><p className="muted light-muted">Registre seus horários com um toque. Os dados ficam salvos neste aparelho.</p><div className="action-grid">
        {!isWorking && !isOnBreak && <button className="primary-button" onClick={() => register('Entrada')}>Registrar entrada</button>}
        {isWorking && <><button className="primary-button" onClick={() => register('Saída')}>Registrar saída</button><button className="secondary-button" onClick={() => register('Início do intervalo')}>Iniciar intervalo</button></>}
        {isOnBreak && <button className="primary-button" onClick={() => register('Fim do intervalo')}>Voltar do intervalo</button>}
      </div><small>Registro manual, rápido e sem senha</small></section>
      <section className="metrics"><div className="metric"><span className="metric-icon green">◷</span><div><strong>{formatMinutes(workedMinutes)}</strong><span>Horas hoje</span></div></div><div className="metric"><span className="metric-icon orange">↗</span><div><strong>{todayEntries.length}</strong><span>Registros</span></div></div></section>
      <section className="section-head"><div><span className="eyebrow">JORNADA</span><h2>Resumo de hoje</h2></div><span className="secure-label">Meta {targetHours}h</span></section>
      <section className="security-card"><div className="security-icon">✓</div><div><h3>{workedMinutes >= targetHours * 60 ? 'Meta cumprida' : `${formatMinutes(Math.max(0, targetHours * 60 - workedMinutes))} restantes`}</h3><p>{todayEntries.length ? 'Seus registros estão salvos neste dispositivo.' : 'Nenhum registro feito hoje.'}</p></div><button className="text-button" onClick={() => setActiveTab('historico')}>Detalhes <span>›</span></button></section>
      <section className="section-head recent-head"><div><span className="eyebrow">HOJE</span><h2>Registros recentes</h2></div><button className="text-button" onClick={() => setActiveTab('historico')}>Ver todos <span>›</span></button></section>
      <div className="entry-list">{todayEntries.length === 0 ? <p className="empty">Nenhum registro ainda.</p> : todayEntries.slice(-4).reverse().map((entry) => <EntryRow key={entry.id} entry={entry} onRemove={removeEntry} />)}</div>
    </>}

    {activeTab === 'historico' && <section className="history-page"><button className="back-button" onClick={() => setActiveTab('inicio')}>‹ Voltar</button><span className="eyebrow">ACOMPANHAMENTO</span><h2>Histórico de pontos</h2><p className="muted">Consulte e remova registros salvos neste aparelho.</p><input className="date-input" type="date" value={historyDate.split('/').reverse().join('-')} onChange={(event) => { const [year, month, day] = event.target.value.split('-'); setHistoryDate(`${day}/${month}/${year}`) }} /><div className="history-summary"><strong>{formatMinutes(historyTotal)}</strong><span>Horas trabalhadas no dia</span></div><div className="history-list">{selectedHistory.length === 0 ? <p className="empty">Nenhum registro nesta data.</p> : selectedHistory.map((entry) => <EntryRow key={entry.id} entry={entry} onRemove={removeEntry} />)}</div></section>}

    {activeTab === 'configuracoes' && <section className="history-page"><button className="back-button" onClick={() => setActiveTab('inicio')}>‹ Voltar</button><span className="eyebrow">PREFERÊNCIAS</span><h2>Configurações</h2><p className="muted">Personalize sua jornada e mantenha seus dados organizados.</p><form className="settings-form" onSubmit={saveProfile}><label>Nome do funcionário<input value={name} onChange={(event) => setName(event.target.value)} /></label><label>Meta diária de horas<input type="number" min="1" max="24" value={targetHours} onChange={(event) => setTargetHours(Number(event.target.value))} /></label><button className="primary-button" type="submit">Salvar configurações</button></form><section className="security-card"><div className="security-icon">▤</div><div><h3>Armazenamento local</h3><p>{entries.length} registro(s) salvo(s) neste dispositivo.</p></div></section><button className="danger-button" onClick={clearAll}>Excluir todos os registros</button><p className="muted">Ponto Digital · versão 1.0.0</p></section>}

    <nav className="bottom-nav"><button className={activeTab === 'inicio' ? 'nav-active' : ''} onClick={() => setActiveTab('inicio')}><span>⌂</span>Início</button><button className={activeTab === 'historico' ? 'nav-active' : ''} onClick={() => setActiveTab('historico')}><span>▤</span>Histórico</button><button className={activeTab === 'configuracoes' ? 'nav-active' : ''} onClick={() => setActiveTab('configuracoes')}><span>⚙</span>Configurações</button></nav>
  </div></main>
}

function EntryRow({ entry, onRemove }: { entry: Entry; onRemove: (id: number) => void }) {
  const isStart = entry.kind === 'Entrada' || entry.kind === 'Fim do intervalo'
  return <div className="entry"><span className={`entry-dot ${isStart ? 'entry-in' : 'entry-out'}`}>{isStart ? '↘' : '↗'}</span><div><strong>{entry.kind}</strong><span>{entry.date}, {entry.time}</span></div><button className="entry-remove" aria-label={`Remover ${entry.kind}`} onClick={() => onRemove(entry.id)}>×</button></div>
}
