export async function up(db) {
  await db.schema.alterTable('employees', t => { t.string('pin_digest').nullable().unique() })
  await db.schema.alterTable('entries', t => { t.string('request_id').nullable().unique() })
  await db.schema.createTable('admins', t => { t.increments('id'); t.string('username').notNullable().unique(); t.string('password_hash').notNullable() })
  await db.schema.createTable('sessions', t => { t.string('token_hash').primary(); t.integer('admin_id').notNullable().references('id').inTable('admins'); t.bigInteger('expires_at').notNullable() })
  await db.schema.createTable('settings', t => { t.string('key').primary(); t.string('value').notNullable() })
  await db.schema.createTable('attempts', t => { t.string('key').primary(); t.integer('count').notNullable(); t.bigInteger('expires_at').notNullable() })
}
export async function down(db) {
  for (const table of ['attempts', 'settings', 'sessions', 'admins']) await db.schema.dropTable(table)
  await db.schema.alterTable('entries', t => t.dropColumn('request_id'))
  await db.schema.alterTable('employees', t => t.dropColumn('pin_digest'))
}
