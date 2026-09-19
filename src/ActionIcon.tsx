export default function ActionIcon({ kind, breakName }: { kind: string; breakName?: string | null }) {
  const pause = kind === 'Início do intervalo'
  const coffee = /caf[eé]/i.test(breakName || '')
  const lunch = /almo[cç]o|jantar|refei[cç]/i.test(breakName || '')
  const style = kind === 'Entrada' ? 'arrival' : kind === 'Saída' ? 'departure' : pause ? 'pause' : 'return'
  return <span className={`action-icon action-${style}`} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {kind === 'Entrada' ? <><path d="M14 4h6v16h-6M3 12h12m-4-4 4 4-4 4" /></> : kind === 'Saída' ? <><path d="M10 4H4v16h6m-1-8h12m-4-4 4 4-4 4" /></> : !pause ? <><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6m-1 3 3 3 5-6" /></> : coffee ? <><path d="M4 9h12v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Zm12 1h2a3 3 0 0 1 0 6h-2M7 3v3m5-3v3" /></> : lunch ? <><path d="M5 3v6m3-6v6M2 3v6a3 3 0 0 0 6 0M5 12v9m13-18c-4 2-4 8 0 9V3Zm0 9v9" /></> : <><path d="M8 5v14M16 5v14" strokeWidth="4" /></>}
  </svg></span>
}
