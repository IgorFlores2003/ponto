export async function up(db) {
  await db.schema.alterTable('entries', t => {
    t.boolean('face_detected').nullable()
    t.string('divergence_status', 32).nullable()
    t.text('divergence_reason').nullable()
    t.boolean('admin_confirmed').defaultTo(false)
    t.string('admin_confirmed_at', 64).nullable()
  })
}

export async function down(db) {
  await db.schema.alterTable('entries', t => {
    t.dropColumn('face_detected')
    t.dropColumn('divergence_status')
    t.dropColumn('divergence_reason')
    t.dropColumn('admin_confirmed')
    t.dropColumn('admin_confirmed_at')
  })
}
