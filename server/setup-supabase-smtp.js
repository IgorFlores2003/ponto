import './env.js'

const required = ['SUPABASE_PROJECT_REF', 'SUPABASE_ACCESS_TOKEN', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM']
try {
  const missing = required.filter(name => !process.env[name])
  if (missing.length) throw new Error(`Configure no .env: ${missing.join(', ')}.`)
  const ref = process.env.SUPABASE_PROJECT_REF
  if (!/^[a-z0-9]{20}$/.test(ref)) throw new Error('SUPABASE_PROJECT_REF inválido.')
  const port = Number(process.env.SMTP_PORT)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SMTP_PORT inválida.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.SMTP_FROM)) throw new Error('SMTP_FROM deve ser um endereço de e-mail.')
  if (!/^[a-z0-9.-]+$/i.test(process.env.SMTP_HOST)) throw new Error('SMTP_HOST deve conter apenas o hostname do provedor.')
  const endpoint = `https://api.supabase.com/v1/projects/${ref}/config/auth`
  const headers = { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' }
  const response = await fetch(endpoint, {
    method: 'PATCH', headers,
    body: JSON.stringify({
      external_email_enabled: true,
      mailer_autoconfirm: false,
      mailer_subjects_confirmation: 'Confirme seu e-mail — Ponto Digital',
      mailer_subjects_recovery: 'Recupere sua senha — Ponto Digital',
      mailer_templates_recovery_content: '<h2>Recupere sua senha</h2><p>Digite este código na tela de recuperação do Ponto Digital:</p><p style="font-size:28px;font-weight:bold">{{ .Token }}</p><p>Se você não solicitou a recuperação, ignore esta mensagem. Sua senha não será alterada.</p>',
      mailer_templates_confirmation_content: '<h2>Confirme seu e-mail</h2><p>Digite este código no Ponto Digital:</p><p style="font-size:28px;font-weight:bold">{{ .Token }}</p><p>Após confirmar, aguarde a aprovação de um administrador da empresa. Se você não solicitou o cadastro, ignore esta mensagem.</p>',
      smtp_admin_email: process.env.SMTP_FROM,
      smtp_host: process.env.SMTP_HOST,
      // The Management API schema expects smtp_port as a string.
      smtp_port: String(port),
      smtp_user: process.env.SMTP_USER,
      smtp_pass: process.env.SMTP_PASSWORD,
      smtp_sender_name: process.env.SMTP_SENDER_NAME || 'Ponto Digital',
    }),
    signal: AbortSignal.timeout(20000), redirect: 'error',
  })
  if (!response.ok) {
    const details = await response.text()
    const safeDetails = [process.env.SUPABASE_ACCESS_TOKEN, process.env.SMTP_PASSWORD, process.env.SMTP_USER]
      .filter(Boolean)
      .reduce((text, secret) => text.split(secret).join('[oculto]'), details)
    throw new Error(`Supabase recusou a configuração SMTP (HTTP ${response.status}): ${safeDetails.slice(0, 1000)}`)
  }
  const check = await fetch(endpoint, { headers, signal: AbortSignal.timeout(20000), redirect: 'error' })
  if (!check.ok) throw new Error(`Configuração enviada, mas a verificação falhou (HTTP ${check.status}).`)
  const config = await check.json()
  if (config.mailer_autoconfirm !== false || config.smtp_host !== process.env.SMTP_HOST || config.smtp_admin_email !== process.env.SMTP_FROM) {
    throw new Error('A configuração retornada não corresponde ao SMTP e à confirmação de e-mail solicitados.')
  }
  console.log('SMTP configurado no Supabase e confirmação de e-mail habilitada. Falta testar a entrega com um cadastro real.')
} catch (error) {
  console.error('Falha ao configurar SMTP:', error.cause?.code || error.message)
  process.exitCode = 1
}
