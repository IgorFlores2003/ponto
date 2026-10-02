export async function up(db) {
  await db.schema.alterTable('admins', t => {
    t.string('supabase_user_id', 36).nullable().unique()
  })
  await db.schema.alterTable('sessions', t => {
    t.string('auth_provider', 16).notNullable().defaultTo('local')
    t.text('provider_session').nullable()
  })
  await db.schema.createTable('admin_registrations', t => {
    t.increments('id')
    t.string('email', 254).notNullable().unique()
    t.string('name', 120).notNullable()
    t.string('supabase_user_id', 36).notNullable().unique()
    t.string('status', 16).notNullable().defaultTo('pending')
    t.string('created_at').notNullable()
    t.string('email_confirmed_at').nullable()
    t.integer('reviewed_by').nullable().references('id').inTable('admins')
    t.string('reviewed_at').nullable()
  })
  if (db.client.config.client === 'pg') {
    await db.raw('alter table admin_registrations enable row level security')
    await db.raw('revoke all on table admin_registrations from anon, authenticated')
  }
}
export async function down(db) {
  await db.schema.dropTable('admin_registrations')
  await db.schema.alterTable('sessions', t => { t.dropColumn('auth_provider'); t.dropColumn('provider_session') })
  await db.schema.alterTable('admins', t => t.dropColumn('supabase_user_id'))
}
