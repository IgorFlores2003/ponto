import { createAdmin, pinDigest } from '../auth.js'

export async function seed(db) {
  if (process.env.NODE_ENV === 'production') throw new Error('Seeds de demonstração não podem ser executados em produção.')
  await db.transaction(async trx => {
    if (!await trx('admins').where({ username: 'admin' }).first()) {
      await createAdmin(trx, 'admin', 'Admin@12345')
    }
    for (const employee of [
      { name: 'Igor', registration: 'DEMO-001', department: 'Operações', pin: '1234' },
      { name: 'Yasmim', registration: 'DEMO-002', department: 'Administrativo', pin: '2344' },
    ]) {
      // Nunca altera um cadastro ou uma senha já existente.
      if (await trx('employees').where({ registration: employee.registration }).first()) continue
      const digest = await pinDigest(trx, employee.pin)
      if (await trx('employees').where({ pin_digest: digest }).first()) {
        throw new Error(`O PIN de demonstração de ${employee.name} já está em uso. Nenhum dado do seed foi salvo.`)
      }
      await trx('employees').insert({ name: employee.name, registration: employee.registration,
        department: employee.department, target_hours: 8, pin_digest: digest, created_at: new Date().toISOString() })
    }
  })
}
