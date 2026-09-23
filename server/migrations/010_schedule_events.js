export async function up(db) {
  await db.schema.createTable('schedule_events', table => {
    table.increments('id')
    table.date('event_date').notNullable().index()
    table.string('kind', 24).notNullable()
    table.string('title', 120).notNullable()
    table.integer('employee_id').unsigned().nullable().references('id').inTable('employees').onDelete('CASCADE')
    table.string('created_at').notNullable()
  })
  if (db.client.config.client === 'pg') {
    await db.raw('alter table schedule_events enable row level security')
    await db.raw('revoke all on table schedule_events from anon, authenticated')
  }
}

export async function down(db) { await db.schema.dropTableIfExists('schedule_events') }
