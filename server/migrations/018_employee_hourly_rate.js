export async function up(db) {
  await db.schema.alterTable('employees', t => t.integer('hourly_rate_cents').nullable())
}
export async function down(db) {
  await db.schema.alterTable('employees', t => t.dropColumn('hourly_rate_cents'))
}
