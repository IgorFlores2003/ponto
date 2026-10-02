// All Supabase credentials stay on the backend. No VITE_ variables are used.
export class SupabaseError extends Error {
  constructor(message = 'Supabase temporariamente indisponível. Tente novamente.', status = 503) {
    super(message)
    this.name = 'SupabaseError'
    this.status = status
  }
}

export function supabaseConfig(env = process.env) {
  const terminalAuthProvider = env.TERMINAL_AUTH_PROVIDER || 'local'
  const photoProvider = env.PHOTO_STORAGE || 'database'
  const adminRegistrationEnabled = env.ADMIN_REGISTRATION_ENABLED === 'true'
  if (!['local', 'supabase'].includes(terminalAuthProvider) || !['database', 'supabase'].includes(photoProvider)) throw new Error('TERMINAL_AUTH_PROVIDER ou PHOTO_STORAGE inválido.')
  const config = {
    terminalAuthProvider, photoProvider, adminRegistrationEnabled,
    url: (env.SUPABASE_URL || '').replace(/\/+$/, ''),
    secretKey: env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '',
    publicKey: env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || '',
    bucket: env.SUPABASE_STORAGE_BUCKET || 'ponto-fotos',
    encryptionKey: env.AUTH_SESSION_ENCRYPTION_KEY || '',
  }
  if (terminalAuthProvider === 'supabase' || photoProvider === 'supabase' || adminRegistrationEnabled) {
    let url
    try { url = new URL(config.url) } catch { throw new Error('Configure SUPABASE_URL no backend.') }
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('SUPABASE_URL deve ser a origem HTTPS do projeto.')
    if (!config.secretKey) throw new Error('Configure SUPABASE_SECRET_KEY no backend.')
    if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(config.bucket)) throw new Error('Nome do bucket de fotos inválido.')
  }
  if (terminalAuthProvider === 'supabase' || adminRegistrationEnabled) {
    if (!config.publicKey) throw new Error('Configure SUPABASE_PUBLISHABLE_KEY no backend.')
    if (!/^[a-f0-9]{64}$/i.test(config.encryptionKey)) throw new Error('Configure AUTH_SESSION_ENCRYPTION_KEY com 32 bytes em hexadecimal.')
  }
  return config
}

export function supabaseClient(config, fetcher = fetch) {
  return async function request(path, { method = 'GET', body, token, admin = false, headers = {}, binary = false } = {}) {
    const key = admin ? config.secretKey : config.publicKey
    // New sb_secret keys belong in apikey, not in the user-JWT header.
    const bearer = token || (admin && key.startsWith('eyJ') ? key : null)
    let response
    try {
      response = await fetcher(`${config.url}${path}`, {
        method,
        headers: { apikey: key, ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
          ...(body !== undefined && !Buffer.isBuffer(body) ? { 'Content-Type': 'application/json' } : {}), ...headers },
        ...(body !== undefined ? { body: Buffer.isBuffer(body) ? body : JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(15000),
        redirect: 'error',
      })
    } catch { throw new SupabaseError() }
    if (!response.ok) {
      // Never forward upstream bodies: they may contain project details or credentials.
      const authDenied = path.startsWith('/auth/v1/') && !admin && [400, 401, 403, 422].includes(response.status)
      const error = new SupabaseError(authDenied ? 'Acesso inválido ou sessão encerrada. Entre novamente.' : undefined, authDenied ? 401 : 503)
      error.upstreamStatus = response.status
      throw error
    }
    if (response.status === 204) return null
    if (binary) return { data: Buffer.from(await response.arrayBuffer()), mime: response.headers.get('content-type')?.split(';')[0] }
    return response.json()
  }
}
