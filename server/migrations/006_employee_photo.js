export async function up(db) {
  await db.schema.alterTable('employees', t => t.text('photo').nullable())
}
export async function down(db) {
  await db.schema.alterTable('employees', t => t.dropColumn('photo'))
}
