export async function up(db) {
  await db.schema.createTable('terminal_users', table => {
    table.increments('id')
    table.string('username', 120).notNullable().unique()
    table.string('supabase_user_id', 36).notNullable().unique()
    table.boolean('active').notNullable().defaultTo(true)
  })
  await db.schema.createTable('terminal_sessions', table => {
    table.string('token_hash').primary()
    table.integer('admin_id').nullable().references('id').inTable('admins').onDelete('CASCADE')
    table.integer('terminal_user_id').nullable().references('id').inTable('terminal_users').onDelete('CASCADE')
    table.bigInteger('expires_at').notNullable()
    table.string('auth_provider', 16).notNullable()
    table.text('provider_session').nullable()
  })
  if (db.client.config.client === 'pg') {
    for (const table of ['terminal_users', 'terminal_sessions']) {
      await db.raw('alter table ?? enable row level security', [table])
      await db.raw('revoke all on table ?? from anon, authenticated', [table])
    }
  }
}
export async function down(db) {
  await db.schema.dropTableIfExists('terminal_sessions')
  await db.schema.dropTableIfExists('terminal_users')
}
