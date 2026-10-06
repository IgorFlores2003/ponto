export async function up(db) {
  await db.schema.createTable('photo_analysis_jobs', table => {
    table.integer('entry_id').primary().references('id').inTable('entries').onDelete('CASCADE')
    table.integer('attempts').notNullable().defaultTo(0)
    table.bigInteger('next_attempt_at').notNullable().defaultTo(0).index()
    table.bigInteger('lease_until').notNullable().defaultTo(0)
  })
  const pending = await db('entries').select('id').where({ divergence_status: 'pending', admin_confirmed: false }).whereNotNull('punch_photo')
  if (pending.length) await db.batchInsert('photo_analysis_jobs', pending.map(row => ({ entry_id: row.id })), 100)
  if (db.client.config.client === 'pg') {
    await db.raw('alter table photo_analysis_jobs enable row level security')
    await db.raw('revoke all on table photo_analysis_jobs from anon, authenticated')
  }
}
export async function down(db) { await db.schema.dropTableIfExists('photo_analysis_jobs') }
