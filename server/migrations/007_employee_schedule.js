export async function up(db) {
  await db.schema.alterTable('employees', table => {
    table.integer('work_minutes').notNullable().defaultTo(480)
    table.integer('break_minutes').notNullable().defaultTo(60)
  })
  await db('employees').update({ work_minutes: db.raw('round(target_hours * 60)') })
}

export async function down(db) {
  await db.schema.alterTable('employees', table => {
    table.dropColumn('work_minutes')
    table.dropColumn('break_minutes')
  })
}
