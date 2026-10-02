export async function up(db) {
  await db.schema.alterTable('employees', t => { t.string('photo_updated_at').nullable().index() })
  // The original upload time is unknown for existing profile pictures.
  // Start their retention window at deployment rather than deleting them immediately.
  await db('employees').whereNotNull('photo').update({ photo_updated_at: new Date().toISOString() })
  await db.schema.createTable('photo_deletion_jobs', t => {
    t.increments('id')
    t.string('reference', 512).notNullable().unique()
    t.string('created_at').notNullable()
  })
  if (db.client.config.client === 'pg') {
    await db.raw('alter table photo_deletion_jobs enable row level security')
    await db.raw('revoke all on table photo_deletion_jobs from anon, authenticated')
  }
}
export async function down(db) {
  await db.schema.dropTable('photo_deletion_jobs')
  await db.schema.alterTable('employees', t => t.dropColumn('photo_updated_at'))
}
