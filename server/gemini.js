function parseDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') return null
  const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl)
  if (!match) return null
  return { mimeType: match[1], data: match[2] }
}

const MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.7-flash',
  'gemini-flash-latest',
]

/**
 * Analisa a foto da batida usando o modelo Gemini Vision.
 * Retorna { face_detected, divergence_status, divergence_reason }
 */
export async function analyzePunchPhoto({ punchPhoto, employeePhoto, apiKey }) {
  const key = apiKey || process.env.GEMINI_API_KEY
  if (!key || !punchPhoto) return null

  const punchParsed = parseDataUrl(punchPhoto)
  if (!punchParsed) return null

  const employeeParsed = parseDataUrl(employeePhoto)

  const parts = []
  if (employeeParsed) {
    parts.push({
      text: `Você é um assistente de conferência biométrica para controle de ponto digital.
Compare a Foto 1 (batida de ponto) com a Foto 2 (cadastro oficial do colaborador).
Regras:
1. "face_detected": true se houver um rosto humano na Foto 1; false se a câmera estiver coberta, apontando pro nada/teto/parede ou sem pessoa.
2. "has_divergence": true se não houver rosto OU se o rosto da Foto 1 for claramente de outra pessoa (suspeita de bater ponto para colega). Pequenas variações de ângulo, barba, óculos ou iluminação NÃO são divergência.
3. "reason": explicação concisa em português (1 frase amigável para o gestor).

Responda em formato JSON:
{ "face_detected": boolean, "has_divergence": boolean, "reason": string }`
    })
    parts.push({ inlineData: { mimeType: punchParsed.mimeType, data: punchParsed.data } })
    parts.push({ inlineData: { mimeType: employeeParsed.mimeType, data: employeeParsed.data } })
  } else {
    parts.push({
      text: `Você é um assistente de conferência para controle de ponto digital.
Analise a Foto da batida de ponto.
Regras:
1. "face_detected": true se houver um rosto humano; false se estiver coberta, sem pessoa ou apontando para parede/teto.
2. "has_divergence": true somente se não houver rosto na foto.
3. "reason": explicação concisa em português (1 frase).

Responda em formato JSON:
{ "face_detected": boolean, "has_divergence": boolean, "reason": string }`
    })
    parts.push({ inlineData: { mimeType: punchParsed.mimeType, data: punchParsed.data } })
  }

  const deadline = Date.now() + 18000
  for (const model of MODELS) {
    const remaining = deadline - Date.now()
    if (remaining <= 0) break
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(Math.min(8000, remaining)),
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
      })

      if (!response.ok) {
        if (response.status === 503 || response.status === 429) {
          // Tenta o próximo modelo da lista
          continue
        }
        console.warn(`Gemini API (${model}) retornou erro:`, response.status)
        continue
      }

      const json = await response.json()
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) continue

      const result = JSON.parse(text)
      if (typeof result.face_detected !== 'boolean' || typeof result.has_divergence !== 'boolean') continue
      const face_detected = result.face_detected
      const has_divergence = Boolean(result.has_divergence)
      const reason = typeof result.reason === 'string' ? result.reason.trim() : ''

      let divergence_status = 'ok'
      if (!face_detected) {
        divergence_status = 'no_face'
      } else if (has_divergence) {
        divergence_status = 'divergence'
      }

      return {
        face_detected,
        divergence_status,
        divergence_reason: reason || (divergence_status === 'divergence' ? 'Sugestão de possível divergência' : null),
      }
    } catch (error) {
      console.warn(`Tentativa com ${model} falhou:`, error.message || error)
    }
  }

  return null
}
