export async function up(db) {
  await db.schema.createTable('employees', table => {
    table.increments('id')
    table.string('name', 120).notNullable()
    table.string('registration', 40).notNullable().unique()
    table.string('department', 120).notNullable().defaultTo('')
    table.float('target_hours').notNullable().defaultTo(8)
    table.string('created_at').notNullable()
  })
  await db.schema.createTable('entries', table => {
    table.increments('id')
    table.integer('employee_id').unsigned().notNullable().references('id').inTable('employees').onDelete('RESTRICT')
    table.string('kind').notNullable()
    table.string('occurred_at').notNullable()
    table.index(['employee_id', 'occurred_at'])
  })
}
export async function down(db) {
  await db.schema.dropTableIfExists('entries')
  await db.schema.dropTableIfExists('employees')
}
