import { createDatabase } from './db.js'
import { createPhotoStorage } from './photo-storage.js'
import { supabaseConfig } from './supabase.js'
import { prunePhotos } from './photo-retention.js'

const db = createDatabase()
try {
  const apply = process.argv.includes('--apply')
  const result = await prunePhotos(db, createPhotoStorage(supabaseConfig()), { apply })
  console.log(apply ? 'Retenção de fotos aplicada neste lote.' : 'Simulação; nenhuma foto foi excluída. Use --apply para aplicar.')
  console.log(JSON.stringify(result))
  if (result.failed) process.exitCode = 1
} catch (error) { console.error('Falha na retenção de fotos:', error.code || error.message); process.exitCode = 1 }
finally { await db.destroy() }
