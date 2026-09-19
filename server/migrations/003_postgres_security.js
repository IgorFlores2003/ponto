// Acesso aos dados apenas pelo backend, nunca pela API pública do Supabase.
export async function up(db) {
  if (db.client.config.client !== 'pg') return
  for (const table of ['employees', 'entries', 'admins', 'sessions', 'settings', 'attempts']) {
    await db.raw('alter table ?? enable row level security', [table])
    await db.raw('revoke all on table ?? from anon, authenticated', [table])
  }
}
export async function down(db) {
  // Não reabre o acesso público ao desfazer migrations.
}
