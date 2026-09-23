export async function up(db) {
  await db.schema.alterTable('employees', table => table.boolean('active').notNullable().defaultTo(true))
}

export async function down(db) {
  await db.schema.alterTable('employees', table => table.dropColumn('active'))
}
