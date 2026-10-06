export async function up(db) {
  await db.schema.createTable('report_closures', table => {
    table.string('month', 7).primary()
    table.text('report_json').notNullable()
    table.string('closed_at').notNullable()
    table.integer('closed_by').notNullable().references('id').inTable('admins')
  })
  if (db.client.config.client === 'pg') {
    await db.raw('alter table report_closures enable row level security')
    await db.raw('revoke all on table report_closures from anon, authenticated')
  }
}
export async function down(db) { await db.schema.dropTableIfExists('report_closures') }
