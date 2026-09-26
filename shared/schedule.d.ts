export type SchedulePerson = { id: number; workdays?: string | number[]; work_minutes?: number; target_hours?: number; break_minutes?: number }
export type ScheduleEvent = { id?: number | string; event_date: string; kind: string; employee_id: number | null; automatic?: boolean; work_minutes?: number | null; break_minutes?: number | null; starts_at?: string | null; ends_at?: string | null }
export function scheduleForDate(employee: SchedulePerson, date: string, events?: ScheduleEvent[]): { workMinutes: number; breakMinutes: number; startsAt: string | null; endsAt: string | null; reason: string }
export function monthlyScheduleMinutes(employee: SchedulePerson, month: string, events?: ScheduleEvent[]): number
