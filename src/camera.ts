export type CameraPermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported'

export interface PhotoCaptureResult {
  photo: string | null
  faceDetected: boolean | null
  error?: 'permission_denied' | 'no_camera' | 'capture_failed' | null
}

/**
 * Verifica o status atual da permissão de câmera.
 */
export async function checkCameraPermission(): Promise<CameraPermissionState> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
    return 'prompt'
  }
  try {
    const result = await navigator.permissions.query({ name: 'camera' as PermissionName })
    return result.state as CameraPermissionState
  } catch {
    return 'prompt'
  }
}

/**
 * Tenta solicitar a permissão de câmera explicitamente.
 */
export async function requestCameraPermission(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return false
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false,
    })
    stream.getTracks().forEach(t => t.stop())
    return true
  } catch {
    return false
  }
}

/**
 * Tenta detectar se há um rosto humano no canvas usando a API nativa FaceDetector do navegador, se disponível.
 */
async function detectFaceClient(canvas: HTMLCanvasElement): Promise<boolean | null> {
  if (typeof window !== 'undefined' && 'FaceDetector' in window) {
    try {
      const FaceDetectorClass = (window as unknown as {
        FaceDetector: new (opts?: { fastMode?: boolean; maxDetectedFaces?: number }) => {
          detect: (source: ImageBitmapSource) => Promise<Array<unknown>>
        }
      }).FaceDetector
      const detector = new FaceDetectorClass({ fastMode: true, maxDetectedFaces: 1 })
      const faces = await detector.detect(canvas)
      return faces.length > 0
    } catch {
      return null
    }
  }
  return null
}

/**
 * Captura uma foto silenciosa usando a câmera frontal do dispositivo.
 * Retorna { photo, faceDetected, error }.
 * Se a permissão for negada ou o dispositivo não tiver câmera, o erro é retornado explicitamente.
 */
export async function captureFrontPhoto(): Promise<PhotoCaptureResult> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return { photo: null, faceDetected: null, error: 'no_camera' }
  }

  let stream: MediaStream | null = null
  let video: HTMLVideoElement | null = null

  try {
    // Tenta primeiro a câmera frontal; se não conseguir por restrição de constraint, tenta qualquer câmera
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      })
    } catch (err: unknown) {
      const errorName = err instanceof Error ? err.name : ''
      if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
        return { photo: null, faceDetected: null, error: 'permission_denied' }
      }
      if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
        return { photo: null, faceDetected: null, error: 'no_camera' }
      }

      // Tenta fallback com { video: true } caso facingMode: 'user' tenha causado falha
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        })
      } catch (fallbackErr: unknown) {
        const fallbackName = fallbackErr instanceof Error ? fallbackErr.name : ''
        if (fallbackName === 'NotAllowedError' || fallbackName === 'PermissionDeniedError') {
          return { photo: null, faceDetected: null, error: 'permission_denied' }
        }
        return { photo: null, faceDetected: null, error: 'no_camera' }
      }
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
      setTimeout(done, 1200)
    })

    // Breve pausa para estabilizar frames do sensor
    await new Promise(r => setTimeout(r, 150))

    const width = video.videoWidth || 480
    const height = video.videoHeight || 640
    if (width === 0 || height === 0) {
      return { photo: null, faceDetected: null, error: 'capture_failed' }
    }

    const canvas = document.createElement('canvas')
    const maxDim = 480
    const scale = Math.min(1, maxDim / Math.max(width, height))
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return { photo: null, faceDetected: null, error: 'capture_failed' }
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Verifica presença de rosto localmente
    const faceDetected = await detectFaceClient(canvas)

    // Gera JPEG otimizado
    const photo = canvas.toDataURL('image/jpeg', 0.65)
    return { photo, faceDetected, error: null }
  } catch (err: unknown) {
    console.warn('Erro ao capturar foto frontal:', err)
    const errName = err instanceof Error ? err.name : ''
    if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
      return { photo: null, faceDetected: null, error: 'permission_denied' }
    }
    return { photo: null, faceDetected: null, error: 'capture_failed' }
  } finally {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
    }
    if (video && video.parentNode) {
      video.parentNode.removeChild(video)
    }
  }
}
