// Shrink phone photos before upload so they load fast and don't eat storage.
export async function compressImage(file, maxSide = 1600, quality = 0.82) {
  if (!file.type.startsWith('image/')) return file
  try {
    const bitmap = await loadBitmap(file)
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h)
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality))
    return blob || file
  } catch {
    return file
  }
}

function loadBitmap(file) {
  if ('createImageBitmap' in window) {
    return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => loadImg(file))
  }
  return loadImg(file)
}

function loadImg(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(img.src)
      resolve(img)
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}
