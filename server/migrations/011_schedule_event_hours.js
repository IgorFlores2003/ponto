export async function up(db) {
  await db.schema.alterTable('schedule_events', table => {
    table.string('starts_at', 5).nullable()
    table.string('ends_at', 5).nullable()
    table.integer('work_minutes').nullable()
    table.integer('break_minutes').nullable()
  })
}
export async function down(db) {
  await db.schema.alterTable('schedule_events', table => {
    table.dropColumns('starts_at', 'ends_at', 'work_minutes', 'break_minutes')
  })
}
