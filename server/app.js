import express from 'express'
import { validPhoto } from './photos.js'
import { matchingBreak, validRule, localDateTime } from './breaks.js'
import { randomBytes } from 'node:crypto'
import { hashPassword, verifyPassword, hashToken, pinDigest, rateLimit } from './auth.js'
import { reportFor, validDate } from './reports.js'
export const transitions = { 'Entrada': ['Saída', 'Início do intervalo'], 'Início do intervalo': ['Fim do intervalo'], 'Fim do intervalo': ['Saída', 'Início do intervalo'], 'Saída': ['Entrada'] }
const columns = ['id', 'name', 'registration', 'department', 'job_title', 'photo', 'target_hours', 'created_at']
const publicEmployee = employee => ({ ...Object.fromEntries(columns.map(key => [key, employee[key]])), has_pin: !!employee.pin_digest })
export function createApp(db, { clock = () => new Date() } = {}) {
  const app = express()
  const dummyHash = hashPassword(randomBytes(24).toString('hex'))
  app.use((req, res, next) => {
    const allowed = (process.env.CORS_ORIGINS || 'http://localhost,https://localhost,capacitor://localhost').split(',')
    if (allowed.includes(req.headers.origin)) {
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin)
      res.setHeader('Vary', 'Origin')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    }
    res.setHeader('Cache-Control', 'no-store')
    if (req.method === 'OPTIONS') return res.sendStatus(204)
    next()
  })
  app.use(express.json({ limit: '400kb' }))
  app.post('/api/auth/login', rateLimit(db, 'login', 10, 15 * 60000), async (req, res) => {
    const { username, password } = req.body || {}
    if (typeof username !== 'string' || typeof password !== 'string' || password.length > 1024) return res.status(400).json({ error: 'Informe usuário e senha.' })
    const admin = await db('admins').where({ username: username.trim().toLowerCase() }).first()
    const valid = await verifyPassword(password, admin?.password_hash || await dummyHash)
    if (!admin || !valid) return res.status(401).json({ error: 'Usuário ou senha inválidos.' })
    const token = randomBytes(32).toString('hex')
    const expires_at = Date.now() + 8 * 3600000
    await db('sessions').where('expires_at', '<=', Date.now()).delete()
    await db('sessions').insert({ token_hash: hashToken(token), admin_id: admin.id, expires_at })
    res.json({ token, expires_at, username: admin.username })
  })
  app.post('/api/terminal/punch', rateLimit(db, 'pin', 30, 60000), async (req, res) => {
    const { pin, kind = 'auto', request_id } = req.body || {}
    if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) return res.status(400).json({ error: 'Informe um PIN de 4 números.' })
    if (typeof request_id !== 'string' || !/^[a-f0-9-]{36}$/i.test(request_id)) return res.status(400).json({ error: 'Identificador de batida inválido.' })
    if (kind !== 'auto' && !Object.hasOwn(transitions, kind)) return res.status(400).json({ error: 'Tipo de batida inválido.' })
    const employee = await db('employees').where({ pin_digest: await pinDigest(db, pin) }).first()
    if (!employee) return res.status(401).json({ error: 'PIN inválido.' })
    const result = await db.transaction(async trx => {
      if (trx.client.config.client === 'pg') await trx('employees').where({ id: employee.id }).forUpdate().first()
      const previous = await trx('entries').where({ request_id }).first()
      if (previous) return previous.employee_id === employee.id ? previous : null
      const last = await trx('entries').where({ employee_id: employee.id }).orderBy('id', 'desc').first()
      const now = clock()
      const rule = matchingBreak(await trx('break_rules').where({ active: true }).orderBy('id'), now)
      let next = kind === 'auto' ? (!last || last.kind === 'Saída' ? 'Entrada' : last.kind === 'Início do intervalo' ? 'Fim do intervalo' : 'Saída') : kind
      if (kind === 'auto' && next === 'Saída' && rule) {
        const { date } = localDateTime(now)
        const alreadyTaken = await trx('entries').where({ employee_id: employee.id, break_rule_id: rule.id, kind: 'Início do intervalo' }).where('occurred_at', '>=', new Date(`${date}T00:00:00-03:00`).toISOString()).first()
        if (!alreadyTaken) next = 'Início do intervalo'
      }
      const breakInfo = next === 'Início do intervalo' ? { break_rule_id: rule?.id || null, break_name: rule?.name || 'Intervalo' } : next === 'Fim do intervalo' ? { break_rule_id: last?.break_rule_id || null, break_name: last?.break_name || 'Intervalo' } : {}
      if (!(last ? transitions[last.kind] : ['Entrada']).includes(next)) return null
      // Evita que dois envios simultâneos gerem entrada e saída acidentais.
      if (last && now.getTime() - Date.parse(last.occurred_at) < 5000) return null
      const [{ id }] = await trx('entries').insert({ employee_id: employee.id, kind: next, occurred_at: now.toISOString(), request_id, ...breakInfo }).returning('id')
      return trx('entries').where({ id }).first()
    })
    if (!result) return res.status(409).json({ error: 'Batida incompatível com a jornada ou registrada há poucos segundos. Confira o tipo e aguarde 5 segundos.' })
    res.json({ employee_name: employee.name, kind: result.kind, break_name: result.break_name, occurred_at: result.occurred_at })
  })
  // Todas as demais rotas da API são exclusivas do administrador.
  app.use('/api', async (req, res, next) => {
    const token = req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1]
    const session = token && await db('sessions').where({ token_hash: hashToken(token) }).where('expires_at', '>', Date.now()).first()
    if (!session) return res.status(401).json({ error: 'Entre como administrador para continuar.' })
    res.locals.session = session
    next()
  })
  app.get('/api/auth/me', async (req, res) => { const admin = await db('admins').where({ id: res.locals.session.admin_id }).first(); res.json({ username: admin.username }) })
  app.post('/api/auth/logout', async (req, res) => { await db('sessions').where({ token_hash: res.locals.session.token_hash }).delete(); res.sendStatus(204) })
  app.get('/api/employees', async (req, res) => res.json((await db('employees').orderBy('name')).map(publicEmployee)))
  app.post('/api/employees', async (req, res) => {
    const { name, registration, department = '', job_title = '', photo = null, target_hours = 8, pin } = req.body || {}
    if (!validPhoto(photo) || typeof name !== 'string' || !name.trim() || name.trim().length > 120 || typeof registration !== 'string' || !registration.trim() || registration.trim().length > 40 || typeof job_title !== 'string' || job_title.trim().length > 120 || typeof department !== 'string' || department.trim().length > 120 || typeof target_hours !== 'number' || !Number.isFinite(target_hours) || target_hours < 1 || target_hours > 24 || typeof pin !== 'string' || !/^\d{4}$/.test(pin)) return res.status(400).json({ error: 'Informe nome, matrícula, jornada entre 1 e 24 horas e PIN de 4 números.' })
    try {
      const [{ id }] = await db('employees').insert({ name: name.trim(), registration: registration.trim(), department: department.trim(), job_title: job_title.trim(), photo: photo || null, target_hours, pin_digest: await pinDigest(db, pin), created_at: new Date().toISOString() }).returning('id')
      res.status(201).json(publicEmployee(await db('employees').where({ id }).first()))
    } catch (error) { if (['SQLITE_CONSTRAINT_UNIQUE', '23505'].includes(error.code)) return res.status(409).json({ error: 'Matrícula ou PIN já utilizado por outro funcionário.' }); throw error }
  })
  app.get('/api/break-rules', async (req, res) => res.json(await db('break_rules').orderBy('starts_at')))
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
  app.get('/api/reports', async (req, res) => {
    const { from, to } = req.query
    if (!validDate(from) || !validDate(to) || from > to || Date.parse(to) - Date.parse(from) > 366 * 86400000) return res.status(400).json({ error: 'Informe um período válido de até 367 dias.' })
    const employees = (await db('employees').orderBy('name')).map(publicEmployee)
    const entries = await db('entries').orderBy('id')
    res.json({ from, to, generated_at: new Date().toISOString(), rows: reportFor(employees, entries, from, to) })
  })
  app.use('/api/employees/:id', async (req, res, next) => {
    const id = Number(req.params.id)
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'Funcionário inválido.' })
    if (!await db('employees').where({ id }).first()) return res.status(404).json({ error: 'Funcionário não encontrado.' })
    res.locals.employeeId = id; next()
  })
  app.post('/api/employees/:id/photo', async (req, res) => {
    const { photo } = req.body || {}
    if (!validPhoto(photo)) return res.status(400).json({ error: 'Envie uma foto JPEG, PNG ou WebP de até 250 KB.' })
    await db('employees').where({ id: res.locals.employeeId }).update({ photo: photo || null })
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
  app.get('/api/employees/:id/entries', async (req, res) => res.json(await db('entries').select('id', 'employee_id', 'kind', 'occurred_at', 'break_name').where({ employee_id: res.locals.employeeId }).orderBy('id')))
  app.use('/api', (req, res) => res.status(404).json({ error: 'Rota não encontrada.' }))
  app.use((error, req, res, next) => {
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Foto muito grande. Escolha uma imagem menor.' })
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' })
    console.error(error.code || error.name)
    res.status(500).json({ error: 'Não foi possível concluir a operação.' })
  })
  return app
}
