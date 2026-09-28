export async function up(db) {
  await db.schema.alterTable('employees', table => {
    table.integer('overtime_rate_cents').nullable()
  })
}

export async function down(db) {
  await db.schema.alterTable('employees', table => {
    table.dropColumn('overtime_rate_cents')
  })
}
