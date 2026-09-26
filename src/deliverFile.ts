import { Capacitor, registerPlugin } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

interface FileOpenerPlugin {
  open(options: { path: string; mimeType?: string }): Promise<void>
}

const FileOpener = registerPlugin<FileOpenerPlugin>('FileOpener')

/** Converte um Blob para base64 (sem o prefixo data:...,) */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** Tenta salvar em ExternalStorage/Download, com fallback para Documents */
async function saveToDevice(filename: string, base64: string): Promise<void> {
  try {
    await Filesystem.writeFile({
      path: `Download/${filename}`,
      data: base64,
      directory: Directory.ExternalStorage,
      recursive: true,
    })
  } catch {
    try {
      await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Documents,
        recursive: true,
      })
    } catch {
      // Ignora — o dispositivo pode restringir acesso direto
    }
  }
}

/** Baixa ou compartilha um arquivo dependendo da plataforma (web ou nativa). */
export async function deliverFile(blob: Blob, filename: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const base64 = await blobToBase64(blob)

      // 1. Salva nos Downloads/Documentos do dispositivo
      await saveToDevice(filename, base64)

      // 2. Salva no cache para compartilhar via FileProvider
      const saved = await Filesystem.writeFile({
        path: `reports/${filename}`,
        data: base64,
        directory: Directory.Cache,
        recursive: true,
      })

      // 3. Abre a caixa "Abrir com" do Android
      try {
        await FileOpener.open({ path: saved.uri, mimeType: blob.type.split(';')[0] })
      } catch (openErr) {
        console.warn('FileOpener falhou, tentando Share:', openErr)
        await Share.share({ title: filename, files: [saved.uri], dialogTitle: 'Abrir com' })
      }

      window.dispatchEvent(new CustomEvent('file-downloaded', { detail: { filename } }))
    } catch (error) {
      if (error && typeof error === 'object' && 'message' in error &&
        /\b(cancelled|canceled)\b/i.test(String(error.message))) return
      console.error('Erro ao baixar arquivo:', error)
      window.dispatchEvent(new CustomEvent('file-download-error'))
    }
    return
  }

  // Web: link de download direto
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  setTimeout(() => { link.remove(); URL.revokeObjectURL(url) }, 1000)

  // Mobile web: pergunta onde abrir
  const isMobile =
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  if (isMobile && typeof navigator.share === 'function') {
    try {
      const file = new File([blob], filename, { type: blob.type.split(';')[0] || 'application/octet-stream' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: filename })
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      console.warn('Compartilhamento cancelado ou não suportado:', error)
    }
  }

  window.dispatchEvent(new CustomEvent('file-downloaded', { detail: { filename } }))
}
