export async function up(db) {
  await db.schema.alterTable('employees', table => {
    table.integer('monthly_minutes').notNullable().defaultTo(9600)
    table.text('workdays').notNullable().defaultTo('[1,2,3,4,5]')
  })
  await db('employees').update({ monthly_minutes: db.raw('work_minutes * 22') })
}

export async function down(db) {
  await db.schema.alterTable('employees', table => {
    table.dropColumn('monthly_minutes')
    table.dropColumn('workdays')
  })
}
