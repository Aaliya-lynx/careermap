// Prepare a photo of a certificate for reading: shrink it in the browser and re-draw it, which also removes
// hidden data such as the GPS position a phone camera stores inside a photo.
const MAX_SIDE = 1400
const MAX_CHARS = 1_100_000      // the server refuses anything bigger than 1.2 million characters

export class ImageError extends Error {}

export async function toSmallJpeg(file) {
  if (file.type === 'application/pdf') {
    throw new ImageError('PDFs cannot be read here. Take a screenshot of the certificate and upload that instead.')
  }
  if (!file.type.startsWith('image/')) throw new ImageError('Please choose a photo or a screenshot (JPG, PNG or WebP).')
  let bitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new ImageError('This image could not be opened. Try a JPG or PNG photo or screenshot.')
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const context = canvas.getContext('2d')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  for (const quality of [0.82, 0.7, 0.55, 0.4]) {
    const url = canvas.toDataURL('image/jpeg', quality)
    if (url.length <= MAX_CHARS) return url
  }
  throw new ImageError('This image is too large. Try a smaller photo or a screenshot.')
}
