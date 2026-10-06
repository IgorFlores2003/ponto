export async function up(db) {
  await db.schema.createTable('ponto_users', table => {
    table.increments('id')
    table.string('username', 120).notNullable().unique()
    table.string('password_hash').notNullable()
    table.boolean('active').notNullable().defaultTo(true)
  })
  await db.schema.createTable('ponto_sessions', table => {
    table.string('token_hash').primary()
    table.integer('ponto_user_id').notNullable().references('id').inTable('ponto_users').onDelete('CASCADE')
    table.bigInteger('expires_at').notNullable()
    table.string('auth_provider', 16).notNullable()
    table.text('provider_session').nullable()
  })
  if (db.client.config.client === 'pg') {
    for (const table of ['ponto_users', 'ponto_sessions']) {
      await db.raw('alter table ?? enable row level security', [table])
      await db.raw('revoke all on table ?? from anon, authenticated', [table])
    }
  }
}
export async function down(db) {
  await db.schema.dropTableIfExists('ponto_sessions')
  await db.schema.dropTableIfExists('ponto_users')
}
