/**
 * Captura uma foto silenciosa usando a câmera frontal do dispositivo.
 * Não exibe interface visual para o usuário e não interrompe o fluxo
 * caso a câmera não esteja disponível ou sem permissão.
 */
export async function captureFrontPhoto(): Promise<string | null> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return null
  }

  let stream: MediaStream | null = null
  let video: HTMLVideoElement | null = null

  try {
    // Tenta primeiro a câmera frontal; se não conseguir, tenta qualquer câmera disponível
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      })
    } catch {
      stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      })
    }

    video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.setAttribute('playsinline', 'true')
    video.style.position = 'fixed'
    video.style.top = '-9999px'
    video.style.left = '-9999px'
    video.style.width = '1px'
    video.style.height = '1px'
    video.style.opacity = '0'
    video.style.pointerEvents = 'none'
    video.setAttribute('aria-hidden', 'true')
    document.body.appendChild(video)
    video.srcObject = stream

    await new Promise<void>(resolve => {
      let resolved = false
      const done = () => {
        if (!resolved) {
          resolved = true
          resolve()
        }
      }
      video!.onloadedmetadata = () => {
        video!.play().then(done).catch(done)
      }
      // Timeout de segurança para não travar a batida de ponto
      setTimeout(done, 1200)
    })

    // Breve pausa para o sensor da câmera estabilizar os primeiros frames
    await new Promise(r => setTimeout(r, 150))

    const width = video.videoWidth || 480
    const height = video.videoHeight || 640
    if (width === 0 || height === 0) return null

    const canvas = document.createElement('canvas')
    const maxDim = 480
    const scale = Math.min(1, maxDim / Math.max(width, height))
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)

    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Gera JPEG otimizado (~20-40 KB)
    return canvas.toDataURL('image/jpeg', 0.65)
  } catch (err) {
    // Falha silenciosa proposital para não impedir o registro de ponto
    console.warn('Captura silenciosa indisponível:', err)
    return null
  } finally {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
    }
    if (video && video.parentNode) {
      video.parentNode.removeChild(video)
    }
  }
}
