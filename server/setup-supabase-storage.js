import './env.js'
import { supabaseConfig, supabaseClient } from './supabase.js'

try {
  const config = supabaseConfig({ ...process.env, PHOTO_STORAGE: 'supabase', TERMINAL_AUTH_PROVIDER: 'local' })
  const request = supabaseClient(config)
  let bucket
  try { bucket = await request(`/storage/v1/bucket/${config.bucket}`, { admin: true }) }
  catch (error) { if (![400, 404].includes(error.upstreamStatus)) throw error }
  if (bucket) {
    if (bucket.public !== false) throw new Error('O bucket já existe e é público. Configure-o como privado antes de ativar as fotos.')
    console.log('Bucket privado já configurado.')
  } else {
    await request('/storage/v1/bucket', { method: 'POST', admin: true, body: {
      id: config.bucket, name: config.bucket, public: false,
      file_size_limit: 250 * 1024, allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp'],
    } })
    console.log('Bucket privado de fotos criado.')
  }
} catch (error) { console.error(error.message); process.exitCode = 1 }
