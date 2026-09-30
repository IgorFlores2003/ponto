import { randomUUID } from 'node:crypto'
import { validPhoto } from './photos.js'
import { supabaseClient, SupabaseError } from './supabase.js'

export const isStoredPhoto = value => typeof value === 'string' && value.startsWith('storage://')
export function createPhotoStorage(config, fetcher) {
  const remote = config.photoProvider === 'supabase'
  const request = supabaseClient(config, fetcher)
  const prefix = `storage://${config.bucket}/`
  const cache = new Map()
  let bucketCheckedUntil = 0
  const objectPath = value => {
    if (!value.startsWith(prefix)) throw new SupabaseError('A foto pertence a outro bucket. Confira a configuração do servidor.')
    const path = value.slice(prefix.length)
    if (!/^(employees|entries)\/[a-zA-Z0-9-]+\/[a-f0-9-]+\.(jpg|png|webp)$/.test(path)) throw new SupabaseError('Referência de foto inválida.')
    return path
  }
  async function ensurePrivate() {
    if (!remote) throw new SupabaseError('Configure o Storage para acessar as fotos já migradas.')
    if (Date.now() < bucketCheckedUntil) return
    const bucket = await request(`/storage/v1/bucket/${config.bucket}`, { admin: true })
    if (bucket.public !== false) throw new SupabaseError('O bucket de fotos precisa ser privado.')
    bucketCheckedUntil = Date.now() + 60000
  }
  async function put(value, folder) {
    if (!value) return null
    if (!validPhoto(value)) throw new Error('Foto inválida.')
    if (!remote) return value
    if (!/^(employees|entries)\/[a-zA-Z0-9-]+$/.test(folder)) throw new Error('Destino de foto inválido.')
    await ensurePrivate()
    const [, type, data] = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(value)
    const path = `${folder}/${randomUUID()}.${type === 'jpeg' ? 'jpg' : type}`
    await request(`/storage/v1/object/${config.bucket}/${path}`, {
      method: 'POST', admin: true, body: Buffer.from(data, 'base64'), headers: { 'Content-Type': `image/${type}`, 'x-upsert': 'false' },
    })
    return prefix + path
  }
  async function remove(value) {
    if (!isStoredPhoto(value)) return
    const path = objectPath(value)
    await request(`/storage/v1/object/${config.bucket}`, { method: 'DELETE', admin: true, body: { prefixes: [path] } })
    cache.delete(value)
  }
  async function discardMany(values) {
    const refs = [...new Set(values.filter(isStoredPhoto))]
    for (let i = 0; i < refs.length; i += 100) {
      const batch = refs.slice(i, i + 100)
      try {
        await request(`/storage/v1/object/${config.bucket}`, { method: 'DELETE', admin: true, body: { prefixes: batch.map(objectPath) } })
        for (const ref of batch) cache.delete(ref)
      } catch { console.warn('Não foi possível limpar fotos sem referência. Execute a revisão do Storage.') }
    }
  }
  async function discard(value) {
    try { await remove(value) }
    catch { console.warn('Não foi possível limpar uma foto sem referência. Execute a revisão do Storage.') }
  }
  async function dataUrl(value) {
    if (!isStoredPhoto(value)) return value
    await ensurePrivate()
    const file = await request(`/storage/v1/object/authenticated/${config.bucket}/${objectPath(value)}`, { admin: true, binary: true })
    const photo = `data:${file.mime};base64,${file.data.toString('base64')}`
    if (!validPhoto(photo)) throw new SupabaseError('O arquivo da foto está inválido.')
    return photo
  }
  async function expose(rows) {
    const refs = [...new Set(rows.flatMap(row => [row?.photo, row?.punch_photo]).filter(isStoredPhoto))]
    if (refs.length) await ensurePrivate()
    const missing = refs.filter(ref => !cache.has(ref) || cache.get(ref).until <= Date.now())
    for (let offset = 0; offset < missing.length; offset += 100) {
      const batch = missing.slice(offset, offset + 100)
      const signed = await request(`/storage/v1/object/sign/${config.bucket}`, { method: 'POST', admin: true, body: { paths: batch.map(objectPath), expiresIn: 3600 } })
      for (const ref of batch) {
        const result = signed.find(item => item.path === objectPath(ref))
        if (!result?.signedURL || result.error) throw new SupabaseError('Não foi possível abrir uma foto. Tente novamente.')
        if (!result.signedURL.startsWith(`/object/sign/${config.bucket}/`)) throw new SupabaseError('Endereço de foto inválido.')
        const url = new URL(`${config.url}/storage/v1${result.signedURL}`)
        if (url.origin !== config.url || !url.pathname.startsWith('/storage/v1/object/sign/')) throw new SupabaseError('Endereço de foto inválido.')
        cache.set(ref, { url: url.href, until: Date.now() + 50 * 60000 })
      }
    }
    const output = rows.map(row => row && ({ ...row,
      ...(isStoredPhoto(row.photo) ? { photo: cache.get(row.photo).url } : {}),
      ...(isStoredPhoto(row.punch_photo) ? { punch_photo: cache.get(row.punch_photo).url } : {}),
    }))
    if (cache.size > 5000) cache.clear()
    return output
  }
  return { put, remove, discard, discardMany, dataUrl, expose, ensurePrivate }
}
