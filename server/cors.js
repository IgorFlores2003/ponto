const nativeOrigins = ['http://localhost', 'https://localhost', 'capacitor://localhost']

export function applyCors(req, res) {
  const origin = req.headers.origin
  if (!origin) return true

  const configuredOrigins = (process.env.CORS_ORIGINS || '')
    .split(',').map(value => value.trim()).filter(Boolean)
  const allowed = new Set([...nativeOrigins, ...configuredOrigins])
  if (!allowed.has(origin)) return false

  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Max-Age', '86400')
  return true
}
