export function weekdayDates(month: string, weekday: number): string[]
export function rosterDates(month: string, weekday: number, firstDate: string, count: number, interval: number): string[]
export type MonthlyAssignment = { employee_id: number; first_date: string; count: number; interval: number; kind: 'Trabalho' | 'Trabalho extra' }
export type MonthlyRoster = { month: string; start_date: string; weekday: number; assignments: MonthlyAssignment[] }
