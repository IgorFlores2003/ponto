import './env.js'
import { readFileSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { supabaseConfig } from './supabase.js'

const root = fileURLToPath(new URL('../', import.meta.url))
try {
  const url = new URL(process.env.DATABASE_URL)
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.password || url.hash) throw new Error('DATABASE_URL inválida ou incompleta.')
  if (process.env.DATABASE_CA_PATH) readFileSync(resolve(root, process.env.DATABASE_CA_PATH))
  const config = supabaseConfig()
  console.log('Configuração básica válida. Credenciais não foram exibidas.')
  console.log(`Cadastro por e-mail: ${config.adminRegistrationEnabled ? 'ativado' : 'desativado'}. Fotos: ${config.photoProvider === 'supabase' ? 'Storage privado' : 'banco de dados'}.`)
  const missing = ['SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM', 'SUPABASE_ACCESS_TOKEN'].filter(key => !process.env[key])
  if (missing.length) console.log(`Pendências para configurar Auth/SMTP/Storage: ${missing.join(', ')}.`)
  if (process.argv.includes('--write-vercel')) {
    const keys = ['DATABASE_URL', 'DATABASE_CA_PATH', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY', 'SUPABASE_STORAGE_BUCKET', 'AUTH_SESSION_ENCRYPTION_KEY', 'ADMIN_REGISTRATION_ENABLED', 'TERMINAL_AUTH_PROVIDER', 'PHOTO_STORAGE', 'CRON_SECRET', 'CORS_ORIGINS', 'GEMINI_API_KEY']
    const lines = ['# Importar no ambiente Production da Vercel. Contém segredos; não compartilhar.', 'NODE_ENV="production"']
    for (const key of keys) if (process.env[key]) lines.push(`${key}=${JSON.stringify(process.env[key])}`)
    const directory = resolve(root, 'release-private')
    mkdirSync(directory, { recursive: true, mode: 0o700 })
    const destination = resolve(directory, 'vercel.env')
    writeFileSync(destination, lines.join('\n') + '\n', { mode: 0o600 })
    chmodSync(destination, 0o600)
    console.log('Arquivo privado atualizado: release-private/vercel.env. A importação não ativa os recursos que ainda estão desabilitados.')
  }
} catch {
  console.error('Configuração inválida. Confira DATABASE_URL, certificado e variáveis exigidas pelos recursos ativados. Nenhum segredo foi exibido.')
  process.exitCode = 1
}
