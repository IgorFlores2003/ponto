export function validPhoto(photo) {
  if (photo === null || photo === '') return true
  if (typeof photo !== 'string' || photo.length > 350000) return false
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(photo)
  if (!match || match[2].length % 4 !== 0) return false
  const data = Buffer.from(match[2], 'base64')
  if (data.length > 250 * 1024) return false
  if (match[1] === 'jpeg') return data.length > 3 && data[0] === 255 && data[1] === 216 && data[2] === 255
  if (match[1] === 'png') return data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
  return data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP'
}
