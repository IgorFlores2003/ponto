export async function up(db) {
  await db.schema.alterTable('entries', t => t.text('punch_photo').nullable())
}
export async function down(db) {
  await db.schema.alterTable('entries', t => t.dropColumn('punch_photo'))
}
