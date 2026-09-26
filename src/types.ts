// ─── Tipos de domínio ────────────────────────────────────────────────────────

export type Employee = {
  id: number
  name: string
  registration: string
  department: string
  job_title: string
  photo: string | null
  target_hours: number
  work_minutes: number
  break_minutes: number
  monthly_minutes?: number
  monthly_month?: string
  workdays?: string
  has_pin: boolean
  active: boolean
}

export type Entry = {
  id: number
  employee_id?: number
  kind: string
  break_name?: string | null
  occurred_at: string
  punch_photo?: string | null
  face_detected?: boolean | null
  divergence_status?: 'ok' | 'divergence' | 'no_face' | 'pending' | 'confirmed' | null
  divergence_reason?: string | null
  admin_confirmed?: boolean
  admin_confirmed_at?: string | null
}

export type ReportRow = Employee & {
  work_seconds: number
  break_seconds: number
  expected_seconds: number
  expected_break_seconds: number
  debt_seconds: number
  extra_break_seconds: number
  current_since: string | null
  current_break_name: string | null
  break_totals: { name: string; seconds: number }[]
  minutes: number
  punches: number
  status: string
}

export type Report = {
  from: string
  to: string
  generated_at: string
  rows: ReportRow[]
}

// ─── Constantes de estilo compartilhadas ─────────────────────────────────────

export const INPUT_CLASS =
  'min-w-0 w-full rounded-xl border border-[#cbded2] bg-white p-3 text-sm text-[#315847] focus-visible:outline-2 focus-visible:outline-[#31835b]'

export const LABEL_CLASS = 'grid gap-1.5 text-xs font-bold text-[#527566]'

// ─── Utilitários de data/hora ─────────────────────────────────────────────────

export const day = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

export const monthStart = () => `${day().slice(0, 7)}-01`

export const timestamp = (value: string) =>
  new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

export const hours = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

// ─── Cliente HTTP ─────────────────────────────────────────────────────────────

const configuredApiBase = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')
export const API_BASE = configuredApiBase
  ? configuredApiBase.endsWith('/api')
    ? configuredApiBase
    : `${configuredApiBase}/api`
  : '/api'

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

export async function api<T>(path: string, body?: unknown, token?: string): Promise<T> {
  const response = await fetch(API_BASE + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  if (response.status === 204) return undefined as T
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(data?.error || `Falha na operação (HTTP ${response.status}).`, response.status)
  if (data === null) throw new ApiError('O servidor retornou uma resposta inválida.', response.status)
  return data
}

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Não foi possível acessar o servidor.'
