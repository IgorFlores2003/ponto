import helmet from 'helmet'
import { isIP } from 'node:net'

export function clientIp(req, env = process.env) {
  // Vercel overwrites this header at its edge. Never trust it on a direct server.
  if (env.VERCEL === '1') {
    const forwarded = req.headers['x-forwarded-for']
    const value = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : ''
    if (isIP(value)) return value
  }
  return req.ip || req.socket?.remoteAddress || 'unknown'
}

export function securityHeaders(config) {
  return helmet({
    contentSecurityPolicy: { directives: {
      defaultSrc: ["'self'"], scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:', ...(config.photoProvider === 'supabase' ? [config.url] : [])],
      connectSrc: ["'self'"], frameSrc: ["'none'"], objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    } },
    crossOriginEmbedderPolicy: false,
  })
}
