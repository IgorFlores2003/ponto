import express from 'express'
import { validPhoto } from './photos.js'
import { createPhotoStorage } from './photo-storage.js'
import { createSessionAuth } from './session-auth.js'
import { createAdminRegistration } from './admin-registration.js'
import { createPasswordManagement } from './password-management.js'
import { supabaseConfig, SupabaseError } from './supabase.js'
import { analyzePunchPhoto } from './gemini.js'
import { parseHourlyRate } from '../shared/money.js'
import { parseDuration } from './durations.js'
import { matchingBreak, validRule, localDateTime } from './breaks.js'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { prunePhotos } from './photo-retention.js'
import { pinDigest, rateLimit } from './auth.js'
import { reportFor, validDate } from './reports.js'
import { applyCors } from './cors.js'
import { saveMonthlyRoster, validateMonthlyRoster } from './monthly-roster.js'
import { planScheduleEvents } from './schedule-events.js'
import { scheduleForDate, monthlyScheduleMinutes } from '../shared/schedule.js'
function validWorkdays(days) { return Array.isArray(days) && days.every(day => Number.isInteger(day) && day >= 0 && day <= 6) && new Set(days).size === days.length }
export const transitions = { 'Entrada': ['Saída do almoço', 'Saída', 'Início do intervalo'], 'Saída do almoço': ['Entrada do almoço'], 'Entrada do almoço': ['Saída', 'Início do intervalo'], 'Início do intervalo': ['Fim do intervalo'], 'Fim do intervalo': ['Saída', 'Início do intervalo'], 'Saída': ['Entrada'] }
const columns = ['id', 'name', 'registration', 'department', 'job_title', 'photo', 'target_hours', 'work_minutes', 'break_minutes', 'workdays', 'overtime_rate_cents', 'hourly_rate_cents', 'created_at']
const publicEmployee = employee => ({ ...Object.fromEntries(columns.map(key => [key, employee[key]])), active: !!employee.active, has_pin: !!employee.pin_digest })
export function createApp(db, { clock = () => new Date(), analyzer = analyzePunchPhoto, config = supabaseConfig(), fetcher } = {}) {
  const app = express()
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1)
  const auth = createSessionAuth(db, config, fetcher)
  const registrations = createAdminRegistration(db, config, fetcher)
  const passwords = createPasswordManagement(db, config, fetcher)
  const terminalAuth = createSessionAuth(db, config, fetcher, 'terminal')
  const photos = createPhotoStorage(config, fetcher)
  const publicEntry = async entry => (await photos.expose([entry]))[0]
  app.use((req, res, next) => {
    const allowed = applyCors(req, res)
    res.setHeader('Cache-Control', 'no-store')
    if (req.method === 'OPTIONS') return allowed ? res.sendStatus(204) : res.status(403).json({ error: 'Origem não permitida.' })
    next()
  })
  app.use(express.json({ limit: '400kb' }))
  app.get('/api/maintenance/photos', async (req, res) => {
    const secret = process.env.CRON_SECRET
    const provided = req.headers.authorization || ''
    const expected = secret ? `Bearer ${secret}` : ''
    if (!secret || Buffer.byteLength(provided) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) return res.status(401).json({ error: 'Acesso não autorizado.' })
    const result = await prunePhotos(db, photos, { apply: true })
    res.status(result.failed ? 503 : 200).json(result)
  })
  app.get('/api/auth/config', (req, res) => res.json({ provider: 'local', registration_enabled: !!config.adminRegistrationEnabled }))
  app.post('/api/auth/signup', rateLimit(db, 'signup', 5, 60 * 60000), async (req, res) => {
    await registrations.signup(req.body)
    res.status(202).json({ message: 'Se o cadastro puder ser realizado, você receberá um código por e-mail. Após confirmar, aguarde a aprovação do administrador.' })
  })
  app.post('/api/auth/resend', rateLimit(db, 'resend-email', 3, 15 * 60000), async (req, res) => {
    await registrations.resend(req.body?.email)
    res.json({ message: 'Se houver uma confirmação pendente, enviaremos um novo código.' })
  })
  app.post('/api/auth/verify-email', rateLimit(db, 'verify-email', 10, 15 * 60000), async (req, res) => {
    await registrations.verify(req.body?.email, req.body?.code)
    res.json({ message: 'E-mail confirmado. Aguarde a aprovação de um administrador para entrar.' })
  })
  app.post('/api/auth/login', rateLimit(db, 'login', 10, 15 * 60000), async (req, res) => {
    res.json(await auth.login(req.body?.username, req.body?.password))
  })
  app.post('/api/auth/forgot-password', rateLimit(db, 'forgot-password', 3, 15 * 60000), async (req, res) => {
    await passwords.forgot(req.body?.email)
    res.json({ message: 'Se houver uma conta com esse e-mail, enviaremos um código de recuperação.' })
  })
  app.post('/api/auth/reset-password', rateLimit(db, 'reset-password', 10, 15 * 60000), async (req, res) => {
    await passwords.reset(req.body)
    res.json({ message: 'Senha alterada. Entre novamente com a nova senha.' })
  })
  app.get('/api/terminal/config', (req, res) => res.json({ provider: config.terminalAuthProvider }))
  app.post('/api/terminal/login', rateLimit(db, 'terminal-login', 10, 15 * 60000), async (req, res) => {
    res.json(await terminalAuth.login(req.body?.username, req.body?.password))
  })
  app.use('/api/terminal', async (req, res, next) => {
    const token = req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1]
    const session = token && await terminalAuth.authenticate(token)
    if (!session) return res.status(401).json({ error: 'Entre para liberar o terminal de ponto.', code: 'TERMINAL_SESSION_EXPIRED' })
    res.locals.terminalSession = session
    next()
  })
  app.get('/api/terminal/me', (req, res) => res.json({ expires_at: Number(res.locals.terminalSession.expires_at) }))
  app.post('/api/terminal/logout', async (req, res) => { await terminalAuth.logout(res.locals.terminalSession); res.sendStatus(204) })
  app.post('/api/terminal/punch', rateLimit(db, 'pin', 30, 60000), async (req, res) => {
    const { pin, kind = 'auto', interval_type, request_id, photo = null, client_face_detected = null } = req.body || {}
    if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) return res.status(400).json({ error: 'Informe um PIN de 4 números.' })
    if (typeof request_id !== 'string' || !/^[a-f0-9-]{36}$/i.test(request_id)) return res.status(400).json({ error: 'Identificador de batida inválido.' })
    if (photo && !validPhoto(photo)) return res.status(400).json({ error: 'Foto de batida inválida.' })
    if (kind !== 'auto' && kind !== 'start_break' && kind !== 'end_break' && kind !== 'interval' && !Object.hasOwn(transitions, kind)) return res.status(400).json({ error: 'Tipo de batida inválido.' })
    if (['start_break', 'interval'].includes(kind) && !['lunch', 'coffee'].includes(interval_type)) return res.status(400).json({ error: 'Selecione almoço ou café.' })
    const employee = await db('employees').where({ pin_digest: await pinDigest(db, pin) }).first()
    if (!employee) return res.status(401).json({ error: 'PIN inválido.' })
    const punch_photo = photo && validPhoto(photo) ? photo : null
    const face_detected = typeof client_face_detected === 'boolean' ? client_face_detected : null
    let divergence_status = null
    let divergence_reason = null
    if (punch_photo) {
      if (face_detected === false) {
        divergence_status = 'no_face'
        divergence_reason = 'Nenhum rosto identificado na captura da câmera.'
      } else if (process.env.GEMINI_API_KEY) {
        divergence_status = 'pending'
      } else {
        divergence_status = 'ok'
      }
    }
    let storedPhoto
    let result
    try { result = await db.transaction(async trx => {
      const query = trx('employees').where({ id: employee.id })
      if (trx.client.config.client === 'pg') query.forUpdate()
      const current = await query.first()
      if (!current || !current.active) return { inactive: true }
      const previous = await trx('entries').where({ request_id }).first()
      if (previous) return previous.employee_id === employee.id ? previous : null
      const last = await trx('entries').where({ employee_id: employee.id }).orderBy('id', 'desc').first()
      const now = clock()
      const rule = kind === 'auto' ? matchingBreak(await trx('break_rules').where({ active: true }).orderBy('id'), now) : null
      let next = kind === 'auto' ? (!last || last.kind === 'Saída' ? 'Entrada' : last.kind === 'Saída do almoço' ? 'Entrada do almoço' : last.kind === 'Início do intervalo' ? 'Fim do intervalo' : 'Saída')
        : kind === 'start_break' || kind === 'interval' && !['Saída do almoço', 'Início do intervalo'].includes(last?.kind) ? interval_type === 'lunch' ? 'Saída do almoço' : 'Início do intervalo'
          : kind === 'end_break' ? last?.kind === 'Saída do almoço' ? 'Entrada do almoço' : last?.kind === 'Início do intervalo' ? 'Fim do intervalo' : null
            : kind === 'interval' ? last?.kind === 'Saída do almoço' ? 'Entrada do almoço' : 'Fim do intervalo'
            : kind
      if (kind === 'auto' && next === 'Saída' && rule) {
        const { date } = localDateTime(now)
        const alreadyTaken = await trx('entries').where({ employee_id: employee.id, break_rule_id: rule.id, kind: 'Início do intervalo' }).where('occurred_at', '>=', new Date(`${date}T00:00:00-03:00`).toISOString()).first()
        if (!alreadyTaken) next = 'Início do intervalo'
      }
      const breakInfo = next === 'Saída do almoço' ? { break_name: 'Almoço' } : next === 'Entrada do almoço' ? { break_name: last?.break_name || 'Almoço' } : next === 'Início do intervalo' ? { break_rule_id: rule?.id || null, break_name: rule?.name || 'Café' } : next === 'Fim do intervalo' ? { break_rule_id: last?.break_rule_id || null, break_name: last?.break_name || 'Café' } : {}
      if (!(last ? transitions[last.kind] || [] : ['Entrada']).includes(next)) return null
      // Evita que dois envios simultâneos gerem entrada e saída acidentais.
      if (last && now.getTime() - Date.parse(last.occurred_at) < 5000) return null
      storedPhoto = await photos.put(punch_photo, `entries/${employee.id}`)
      const [{ id }] = await trx('entries').insert({
        employee_id: employee.id,
        kind: next,
        occurred_at: now.toISOString(),
        request_id,
        punch_photo: storedPhoto,
        face_detected,
        divergence_status,
        divergence_reason,
        admin_confirmed: false,
        ...breakInfo,
      }).returning('id')
      return trx('entries').where({ id }).first()
    }) } catch (error) { await photos.discard(storedPhoto); throw error }
    if (result?.inactive) return res.status(403).json({ error: 'Funcionário desativado. Procure o administrador.' })
    if (!result) return res.status(409).json({ error: 'Batida incompatível com a jornada ou registrada há poucos segundos. Confira o tipo e aguarde 5 segundos.' })

    // Se houver foto e chave Gemini, roda análise assíncrona sem travar a resposta para o funcionário
    if (result.punch_photo && process.env.GEMINI_API_KEY && result.id && result.divergence_status === 'pending') {
      void (async () => {
        try {
          const analysis = await analyzer({
            punchPhoto: await photos.dataUrl(result.punch_photo),
            employeePhoto: await photos.dataUrl(employee.photo),
          })
          if (analysis) {
            await db('entries').where({ id: result.id, admin_confirmed: false }).update({
              face_detected: analysis.face_detected,
              divergence_status: analysis.divergence_status,
              divergence_reason: analysis.divergence_reason,
            })
          }
        } catch (err) {
          // O banco pode fechar antes da requisição externa terminar
          if (!/connection|closed|pool/i.test(err?.message || '')) {
            console.warn('Erro ao processar análise para batida', result.id, err?.message || err)
          }
        }
      })()
    }

    res.json({ employee_name: employee.name, kind: result.kind, break_name: result.break_name, occurred_at: result.occurred_at })
  })
  app.get('/api/terminal/break-rules', async (req, res) => {
    const { date } = localDateTime()
    res.json(await db('break_rules').select('id', 'name', 'starts_at', 'ends_at', 'effective_from').where({ active: true }).where('effective_from', '<=', date).orderBy('starts_at'))
  })
  // Todas as demais rotas da API são exclusivas do administrador.
  app.use('/api', async (req, res, next) => {
    const token = req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1]
    const session = token && await auth.authenticate(token)
    if (!session) return res.status(401).json({ error: 'Entre como administrador para continuar.' })
    res.locals.session = session
    next()
  })
  app.get('/api/auth/me', async (req, res) => { const admin = await db('admins').where({ id: res.locals.session.admin_id }).first(); res.json({ username: admin.username }) })
  app.post('/api/auth/change-password', rateLimit(db, 'change-password', 5, 15 * 60000), async (req, res) => {
    await passwords.change(res.locals.session.admin_id, req.body)
    res.json({ message: 'Senha alterada. Entre novamente com a nova senha.' })
  })
  app.get('/api/admin-registrations', async (req, res) => {
    res.json(await db('admin_registrations').select('id', 'name', 'email', 'status', 'created_at', 'email_confirmed_at').where({ status: 'pending' }).orderBy('id'))
  })
  app.post('/api/admin-registrations/:id/review', async (req, res) => {
    await registrations.review(Number(req.params.id), req.body?.action, res.locals.session.admin_id)
    res.json({ ok: true })
  })
  app.post('/api/auth/logout', async (req, res) => { await auth.logout(res.locals.session); res.sendStatus(204) })
  app.get('/api/employees', async (req, res) => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(clock())
    const month = req.query.month ?? today.slice(0, 7)
    if (typeof month !== 'string' || !validDate(`${month}-01`)) return res.status(400).json({ error: 'Informe um mês válido (AAAA-MM).' })
    const events = await db('schedule_events').select('*', db.raw('CAST(event_date AS TEXT) AS event_date')).whereBetween('event_date', [`${month}-01`, `${month}-${new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate()}`])
    const employees = (await db('employees').orderBy('name')).map(publicEmployee)
    res.json(await photos.expose(employees.map(employee => ({ ...employee, monthly_month: month, monthly_minutes: monthlyScheduleMinutes(employee, month, events) }))))
  })
  app.post('/api/employees', async (req, res) => {
    const { name, registration, department = '', job_title = '', photo = null, work_time, break_time, pin, overtime_rate = '', hourly_rate = '' } = req.body || {}
    const hourly_rate_cents = parseHourlyRate(hourly_rate)
    if (hourly_rate_cents === undefined) return res.status(400).json({ error: 'Informe o valor da hora normal em reais, com até duas casas decimais.' })
    const overtime_rate_cents = parseHourlyRate(overtime_rate)
    if (overtime_rate_cents === undefined) return res.status(400).json({ error: 'Informe o valor da hora extra em reais, com até duas casas decimais.' })
    const work_minutes = parseDuration(work_time ?? '08:00')
    const workdays = req.body?.workdays ?? [1, 2, 3, 4, 5]
    const break_minutes = parseDuration(break_time ?? '01:00')
    if (!validPhoto(photo) || typeof name !== 'string' || !name.trim() || name.trim().length > 120 || (registration !== undefined && (typeof registration !== 'string' || registration.trim().length > 40)) || typeof job_title !== 'string' || job_title.trim().length > 120 || typeof department !== 'string' || department.trim().length > 120 || (work_minutes === null || work_minutes < 1 || work_minutes > 1440) || (break_minutes === null || break_minutes < 0 || break_minutes > 720) || !validWorkdays(workdays) || typeof pin !== 'string' || !/^\d{4}$/.test(pin)) return res.status(400).json({ error: 'Informe nome, função, serviço (HH:MM), intervalo (HH:MM) e PIN de 4 números.' })
    let storedPhoto, id
    try {
      storedPhoto = await photos.put(photo, `employees/${randomBytes(16).toString('hex')}`)
      const generatedRegistration = registration?.trim() || `FUNC-${Date.now()}-${randomBytes(3).toString('hex')}`
      const created = await db('employees').insert({ name: name.trim(), registration: generatedRegistration, department: department.trim(), job_title: job_title.trim(), photo: storedPhoto, photo_updated_at: storedPhoto ? new Date().toISOString() : null, target_hours: work_minutes / 60, work_minutes, break_minutes, workdays: JSON.stringify(workdays), overtime_rate_cents, hourly_rate_cents, pin_digest: await pinDigest(db, pin), created_at: new Date().toISOString() }).returning('id')
      id = created[0].id
    } catch (error) {
      await photos.discard(storedPhoto)
      if (['SQLITE_CONSTRAINT_UNIQUE', '23505'].includes(error.code)) return res.status(409).json({ error: 'Matrícula ou PIN já utilizado por outro funcionário.' })
      throw error
    }
    // Return the submitted photo; a subsequent listing gets its signed URL.
    res.status(201).json({ ...publicEmployee(await db('employees').where({ id }).first()), photo })
  })
  app.get('/api/break-rules', async (req, res) => res.json(await db('break_rules').where({ active: true }).orderBy('starts_at')))
  app.post('/api/break-rules', async (req, res) => {
    const rule = req.body || {}
    if (!validRule(rule) || rule.effective_from < localDateTime().date) return res.status(400).json({ error: 'Informe nome, faixa de horário no mesmo dia e início de vigência a partir de hoje.' })
    const result = await db.transaction(async trx => {
      if (trx.client.config.client === 'pg') await trx.raw('select pg_advisory_xact_lock(845723)')
      const conflict = await trx('break_rules').where({ active: true }).where('starts_at', '<', rule.ends_at).where('ends_at', '>', rule.starts_at).first()
      if (conflict) return null
      const [{ id }] = await trx('break_rules').insert({ name: rule.name.trim(), starts_at: rule.starts_at, ends_at: rule.ends_at, effective_from: rule.effective_from, active: true }).returning('id')
      return trx('break_rules').where({ id }).first()
    })
    if (!result) return res.status(409).json({ error: 'Essa faixa coincide com outra pausa ativa. Use horários diferentes ou desative a pausa anterior.' })
    res.status(201).json(result)
  })
  app.post('/api/break-rules/:id/deactivate', async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'Pausa inválida.' })
    const count = await db('break_rules').where({ id }).update({ active: false })
    if (!count) return res.status(404).json({ error: 'Pausa não encontrada.' })
    res.sendStatus(204)
  })
  app.post('/api/break-rules/:id/delete', async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'Pausa inválida.' })
    const count = await db('break_rules').where({ id }).update({ active: false })
    if (!count) return res.status(404).json({ error: 'Pausa não encontrada.' })
    res.sendStatus(204)
  })
  app.post('/api/break-rules/:id', async (req, res) => {
    const id = Number(req.params.id)
    const rule = req.body || {}
    if (!Number.isSafeInteger(id) || id <= 0 || !validRule(rule) || rule.effective_from < localDateTime().date) return res.status(400).json({ error: 'Informe uma pausa válida a partir de hoje.' })
    const conflict = await db('break_rules').where({ active: true }).whereNot({ id }).where('starts_at', '<', rule.ends_at).where('ends_at', '>', rule.starts_at).first()
    if (conflict) return res.status(409).json({ error: 'Essa faixa coincide com outra pausa ativa.' })
    const count = await db('break_rules').where({ id }).update({ name: rule.name.trim(), starts_at: rule.starts_at, ends_at: rule.ends_at, effective_from: rule.effective_from })
    if (!count) return res.status(404).json({ error: 'Pausa não encontrada.' })
    res.json(await db('break_rules').where({ id }).first())
  })
  const eventColumns = ['schedule_events.id', db.raw('CAST(schedule_events.event_date AS TEXT) AS event_date'), 'schedule_events.kind', 'schedule_events.title', 'schedule_events.employee_id', 'employees.name as employee_name', 'schedule_events.starts_at', 'schedule_events.ends_at', 'schedule_events.work_minutes', 'schedule_events.break_minutes']
  app.get('/api/schedule-events', async (req, res) => {
    const { from, to } = req.query
    if ((from !== undefined && !validDate(from)) || (to !== undefined && !validDate(to)) || (from && to && from > to)) return res.status(400).json({ error: 'Informe um período válido.' })
    const query = db('schedule_events').leftJoin('employees', 'schedule_events.employee_id', 'employees.id')
      .select(eventColumns)
      .orderBy('schedule_events.event_date').orderBy('schedule_events.id')
    if (from) query.where('schedule_events.event_date', '>=', from)
    if (to) query.where('schedule_events.event_date', '<=', to)
    res.json(await query)
  })
  app.post('/api/schedule-events', async (req, res) => {
    let planned
    try { planned = planScheduleEvents(req.body || {}) }
    catch (error) { return res.status(400).json({ error: error.message }) }
    const employee_id = planned[0].employee_id
    if (employee_id !== null && !await db('employees').where({ id: employee_id }).first()) return res.status(404).json({ error: 'Funcionário não encontrado.' })
    const created = await db.transaction(async trx => {
      const ids = []
      for (const event of planned) {
        const [{ id }] = await trx('schedule_events').insert({ ...event, created_at: new Date().toISOString() }).returning('id')
        ids.push(id)
      }
      return trx('schedule_events').leftJoin('employees', 'schedule_events.employee_id', 'employees.id').select(eventColumns).whereIn('schedule_events.id', ids).orderBy('schedule_events.event_date')
    })
    res.status(201).json(req.body?.repeat || req.body?.kind === 'Atestado' ? created : created[0])
  })
  app.post('/api/schedule-month', async (req, res) => {
    try { validateMonthlyRoster(req.body || {}) }
    catch (error) { return res.status(400).json({ error: error.message }) }
    try { res.status(201).json(await saveMonthlyRoster(db, req.body, eventColumns)) }
    catch (error) {
      if (error.message.startsWith('A equipe mudou.')) return res.status(409).json({ error: error.message })
      throw error
    }
  })
  app.post('/api/schedule-day', async (req, res) => {
    const { event_date, assignments } = req.body || {}
    if (!validDate(event_date) || !Array.isArray(assignments) || assignments.length > 1000 ||
      assignments.some(item => !item || !Number.isSafeInteger(item.employee_id) || item.employee_id <= 0 || typeof item.working !== 'boolean') ||
      new Set(assignments.map(item => item.employee_id)).size !== assignments.length) {
      return res.status(400).json({ error: 'Informe uma data e uma seleção de funcionários válidas.' })
    }
    const result = await db.transaction(async trx => {
      const employees = await trx('employees').where({ active: true })
      if (employees.length !== assignments.length || employees.some(employee => !assignments.some(item => item.employee_id === employee.id))) return null
      const events = await trx('schedule_events').select('*', db.raw('CAST(event_date AS TEXT) AS event_date')).where({ event_date })
      const ids = []
      for (const employee of employees) {
        const { working } = assignments.find(item => item.employee_id === employee.id)
        if ((scheduleForDate(employee, event_date, events).workMinutes > 0) === working) continue
        const [{ id }] = await trx('schedule_events').insert({ event_date, employee_id: employee.id, kind: working ? 'Trabalho' : 'Folga', title: 'Escala do dia', created_at: new Date().toISOString() }).returning('id')
        ids.push(id)
      }
      return trx('schedule_events').leftJoin('employees', 'schedule_events.employee_id', 'employees.id').select(eventColumns).whereIn('schedule_events.id', ids)
    })
    if (result === null) return res.status(409).json({ error: 'A equipe mudou. Atualize a página e selecione novamente quem trabalha.' })
    res.status(201).json(result)
  })
  app.post('/api/schedule-events/:id/delete', async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'Evento inválido.' })
    const count = await db('schedule_events').where({ id }).delete()
    if (!count) return res.status(404).json({ error: 'Evento não encontrado.' })
    res.sendStatus(204)
  })
  app.get('/api/reports', async (req, res) => {
    const { from, to } = req.query
    if (!validDate(from) || !validDate(to) || from > to || Date.parse(to) - Date.parse(from) > 366 * 86400000) return res.status(400).json({ error: 'Informe um período válido de até 367 dias.' })
    const employees = (await db('employees').orderBy('name')).map(publicEmployee)
    // Busca batidas no período + 30 dias antes (para capturar jornadas abertas antes de `from`)
    const windowStart = new Date(Date.parse(from) - 30 * 86400000).toISOString().slice(0, 10)
    const windowEnd = `${to}T23:59:59.999Z`
    const entries = await db('entries')
      .where('occurred_at', '>=', `${windowStart}T00:00:00.000Z`)
      .where('occurred_at', '<=', windowEnd)
      .orderBy('id')
    const events = await db('schedule_events').select('id', db.raw('CAST(event_date AS TEXT) AS event_date'), 'kind', 'employee_id', 'starts_at', 'ends_at', 'work_minutes', 'break_minutes')
    res.json({ from, to, generated_at: new Date().toISOString(), rows: await photos.expose(reportFor(employees, entries, from, to, Date.now(), events)) })
  })
  app.use('/api/employees/:id', async (req, res, next) => {
    const id = Number(req.params.id)
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'Funcionário inválido.' })
    if (!await db('employees').where({ id }).first()) return res.status(404).json({ error: 'Funcionário não encontrado.' })
    res.locals.employeeId = id; next()
  })
  app.post('/api/employees/:id/status', async (req, res) => {
    const { active } = req.body || {}
    if (typeof active !== 'boolean') return res.status(400).json({ error: 'Informe um status válido.' })
    await db('employees').where({ id: res.locals.employeeId }).update({ active })
    res.sendStatus(204)
  })
  app.post('/api/employees/:id/delete', async (req, res) => {
    // schedule_events was added after the employee and punch tables. Keep
    // deletion working against databases that have not applied that migration.
    const hasScheduleEvents = await db.schema.hasTable('schedule_events')
    const removedPhotos = []
    await db.transaction(async trx => {
      const query = trx('employees').where({ id: res.locals.employeeId })
      if (trx.client.config.client === 'pg') query.forUpdate()
      const employee = await query.first()
      if (!employee) return
      removedPhotos.push(employee.photo, ...await trx('entries').where({ employee_id: employee.id }).pluck('punch_photo'))
      await trx('entries').where({ employee_id: res.locals.employeeId }).delete()
      if (hasScheduleEvents) await trx('schedule_events').where({ employee_id: res.locals.employeeId }).delete()
      await trx('employees').where({ id: res.locals.employeeId }).delete()
    })
    await photos.discardMany(removedPhotos)
    res.sendStatus(204)
  })
  app.post('/api/employees/:id/photo', async (req, res) => {
    const { photo } = req.body || {}
    if (!validPhoto(photo)) return res.status(400).json({ error: 'Envie uma foto JPEG, PNG ou WebP de até 250 KB.' })
    let storedPhoto, previous
    try {
      storedPhoto = await photos.put(photo, `employees/${res.locals.employeeId}`)
      await db.transaction(async trx => {
        const query = trx('employees').where({ id: res.locals.employeeId })
        if (trx.client.config.client === 'pg') query.forUpdate()
        previous = await query.first()
        if (!previous) throw new Error('Funcionário removido durante a atualização.')
        await trx('employees').where({ id: previous.id }).update({ photo: storedPhoto, photo_updated_at: storedPhoto ? new Date().toISOString() : null })
      })
    } catch (error) { await photos.discard(storedPhoto); throw error }
    await photos.discard(previous.photo)
    res.sendStatus(204)
  })
  app.post('/api/employees/:id/schedule', async (req, res) => {
    const { department = '', job_title = '', work_time, break_time, workdays, overtime_rate, hourly_rate } = req.body || {}
    const hourly_rate_cents = hourly_rate === undefined ? undefined : parseHourlyRate(hourly_rate)
    if (hourly_rate !== undefined && hourly_rate_cents === undefined) return res.status(400).json({ error: 'Informe o valor da hora normal em reais, com até duas casas decimais.' })
    const overtime_rate_cents = overtime_rate === undefined ? undefined : parseHourlyRate(overtime_rate)
    if (overtime_rate !== undefined && overtime_rate_cents === undefined) return res.status(400).json({ error: 'Informe o valor da hora extra em reais, com até duas casas decimais.' })
    const work_minutes = parseDuration(work_time)
    const break_minutes = parseDuration(break_time)
    if (typeof department !== 'string' || department.length > 120 || typeof job_title !== 'string' || job_title.length > 120 || work_minutes === null || work_minutes < 1 || work_minutes > 1440 || break_minutes === null || break_minutes < 0 || break_minutes > 720 || !validWorkdays(workdays)) return res.status(400).json({ error: 'Informe função, departamento, serviço e intervalo válidos.' })
    await db('employees').where({ id: res.locals.employeeId }).update({ department: department.trim(), job_title: job_title.trim(), target_hours: work_minutes / 60, work_minutes, break_minutes, workdays: JSON.stringify(workdays), ...(overtime_rate !== undefined ? { overtime_rate_cents } : {}), ...(hourly_rate !== undefined ? { hourly_rate_cents } : {}) })
    res.sendStatus(204)
  })
  app.post('/api/employees/:id/job-title', async (req, res) => {
    const { job_title } = req.body || {}
    if (typeof job_title !== 'string' || job_title.trim().length > 120) return res.status(400).json({ error: 'Informe uma função com até 120 caracteres.' })
    await db('employees').where({ id: res.locals.employeeId }).update({ job_title: job_title.trim() })
    res.sendStatus(204)
  })
  app.post('/api/employees/:id/pin', async (req, res) => {
    const { pin } = req.body || {}
    if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) return res.status(400).json({ error: 'Informe um PIN de 4 números.' })
    try { await db('employees').where({ id: res.locals.employeeId }).update({ pin_digest: await pinDigest(db, pin) }); res.sendStatus(204) }
    catch (error) { if (['SQLITE_CONSTRAINT_UNIQUE', '23505'].includes(error.code)) return res.status(409).json({ error: 'PIN já utilizado por outro funcionário.' }); throw error }
  })
  app.get('/api/employees/:id/entries', async (req, res) => {
    const entries = await db('entries').select('id', 'employee_id', 'kind', 'occurred_at', 'break_name', 'punch_photo', 'face_detected', 'divergence_status', 'divergence_reason', 'admin_confirmed', 'admin_confirmed_at').where({ employee_id: res.locals.employeeId }).orderBy('id')
    res.json(await photos.expose(entries))
  })
  app.get('/api/entry-alerts', async (req, res) => {
    const rawPage = req.query.page ?? '1'
    if (typeof rawPage !== 'string' || !/^[1-9]\d{0,5}$/.test(rawPage)) return res.status(400).json({ error: 'Página inválida.' })
    const page = Number(rawPage), pageSize = 20
    const pending = () => db('entries').whereIn('divergence_status', ['divergence', 'no_face'])
      .where(builder => builder.where('admin_confirmed', false).orWhereNull('admin_confirmed'))
    const [{ total }, rows] = await Promise.all([
      pending().count('* as total').first(),
      pending().join('employees', 'employees.id', 'entries.employee_id')
        .select('entries.id', 'entries.employee_id', 'entries.kind', 'entries.break_name', 'entries.occurred_at', 'entries.divergence_status', 'entries.divergence_reason', 'employees.name as employee_name')
        .orderBy('entries.occurred_at', 'desc').orderBy('entries.id', 'desc').limit(pageSize).offset((page - 1) * pageSize),
    ])
    res.json({ total: Number(total), page, page_size: pageSize, rows })
  })
  app.get('/api/entries/:id', async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'Batida inválida.' })
    const entry = await db('entries').where({ id }).first()
    if (!entry) return res.status(404).json({ error: 'Batida não encontrada.' })
    const employee = await db('employees').where({ id: entry.employee_id }).first()
    const [visibleEntry, visibleEmployee] = await photos.expose([entry, publicEmployee(employee)])
    res.json({ entry: visibleEntry, employee: visibleEmployee })
  })
  app.post('/api/entries/:id/confirm', async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'Batida inválida.' })
    const entry = await db('entries').where({ id }).first()
    if (!entry) return res.status(404).json({ error: 'Batida não encontrada.' })
    const status = req.body?.status === 'rejected' ? 'rejected' : 'confirmed'
    await db('entries').where({ id }).update({
      admin_confirmed: true,
      admin_confirmed_at: new Date().toISOString(),
      divergence_status: status,
    })
    res.json(await publicEntry(await db('entries').where({ id }).first()))
  })
  app.post('/api/entries/:id/reject', async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'Batida inválida.' })
    const entry = await db('entries').where({ id }).first()
    if (!entry) return res.status(404).json({ error: 'Batida não encontrada.' })
    await db('entries').where({ id }).update({
      admin_confirmed: true,
      admin_confirmed_at: new Date().toISOString(),
      divergence_status: 'rejected',
    })
    res.json(await publicEntry(await db('entries').where({ id }).first()))
  })
  app.post('/api/entries/:id/analyze', async (req, res) => {
    const id = Number(req.params.id)
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'Batida inválida.' })
    const entry = await db('entries').where({ id }).first()
    if (!entry) return res.status(404).json({ error: 'Batida não encontrada.' })
    if (!entry.punch_photo) return res.status(400).json({ error: 'Batida sem foto.' })
    if (entry.admin_confirmed) return res.json(await publicEntry(entry))
    const employee = await db('employees').where({ id: entry.employee_id }).first()
    const analysis = await analyzer({
      punchPhoto: await photos.dataUrl(entry.punch_photo),
      employeePhoto: await photos.dataUrl(employee?.photo),
    })
    if (analysis) {
      await db('entries').where({ id, admin_confirmed: false }).update({
        face_detected: analysis.face_detected,
        divergence_status: analysis.divergence_status,
        divergence_reason: analysis.divergence_reason,
      })
    }
    res.json(await publicEntry(await db('entries').where({ id }).first()))
  })
  app.use('/api', (req, res) => res.status(404).json({ error: 'Rota não encontrada.' }))
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error)
    if (error instanceof SupabaseError) return res.status(error.status).json({ error: error.message })
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Foto muito grande. Escolha uma imagem menor.' })
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' })
    const code = error.code || error.name
    console.error('API request failed:', code, req.method, req.path)
    // A disconnected database is temporary; missing schema needs migrations.
    const unavailable = ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', '57P01', '53300'].includes(error.code)
      || /does not exist|no such table|undefined table/i.test(error.message || '')
    if (unavailable) return res.status(503).json({ error: /does not exist|no such table|undefined table/i.test(error.message || '')
      ? 'O banco precisa receber as migrations mais recentes.'
      : 'Banco de dados temporariamente indisponível. Tente novamente.' })
    res.status(500).json({ error: 'Não foi possível concluir a operação. Tente novamente.' })
  })
  return app
}
