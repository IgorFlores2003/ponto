export async function up(db) {
  await db.schema.createTable('break_rules', t => {
    t.increments('id'); t.string('name', 80).notNullable(); t.string('starts_at', 5).notNullable(); t.string('ends_at', 5).notNullable(); t.string('effective_from', 10).notNullable(); t.boolean('active').notNullable().defaultTo(true)
  })
  await db.schema.alterTable('entries', t => {
    t.integer('break_rule_id').nullable().references('id').inTable('break_rules')
    t.string('break_name', 80).nullable()
  })
  if (db.client.config.client === 'pg') {
    await db.raw('alter table break_rules enable row level security')
    await db.raw('revoke all on table break_rules from anon, authenticated')
  }
}
export async function down(db) {
  await db.schema.alterTable('entries', t => { t.dropColumn('break_rule_id'); t.dropColumn('break_name') })
  await db.schema.dropTable('break_rules')
}
