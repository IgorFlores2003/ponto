export async function up(db) {
  await db.schema.alterTable('employees', table => table.string('job_title', 120).notNullable().defaultTo(''))
}
export async function down(db) {
  await db.schema.alterTable('employees', table => table.dropColumn('job_title'))
}
