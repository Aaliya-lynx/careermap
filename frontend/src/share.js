// Share links: the roadmap travels inside the URL (after the #), so no server stores anything.
// The data is compressed when the browser supports it, then written as URL-safe text.

const toBase64Url = (bytes) => {
  let text = ''
  bytes.forEach((b) => { text += String.fromCharCode(b) })
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const fromBase64Url = (text) => {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=')
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}

async function pipe(bytes, stream) {
  const result = new Response(new Blob([bytes]).stream().pipeThrough(stream))
  return new Uint8Array(await result.arrayBuffer())
}

export async function encodeShare(data) {
  const bytes = new TextEncoder().encode(JSON.stringify(data))
  if (typeof CompressionStream === 'function') {
    try { return 'z.' + toBase64Url(await pipe(bytes, new CompressionStream('gzip'))) } catch { /* fall back below */ }
  }
  return 'p.' + toBase64Url(bytes)
}

// Returns the shared object, or null if the text is not a valid share link.
export async function decodeShare(text) {
  try {
    const [kind, body] = [text.slice(0, 2), text.slice(2)]
    let bytes = fromBase64Url(body)
    if (kind === 'z.') bytes = await pipe(bytes, new DecompressionStream('gzip'))
    else if (kind !== 'p.') return null
    const data = JSON.parse(new TextDecoder().decode(bytes))
    return data && typeof data === 'object' ? data : null
  } catch {
    return null
  }
}

export async function shareUrl(data) {
  return `${window.location.origin}${window.location.pathname}#r=${await encodeShare(data)}`
}

// Keep only what the app needs from a shared roadmap: the server cleans the steps again before they are used.
export function readShared(data) {
  const roadmap = data?.roadmap
  if (!roadmap || !Array.isArray(roadmap.nodes)) return null
  const text = (value, size) => (typeof value === 'string' ? value.slice(0, size) : '')
  return {
    roadmap: {
      title: text(roadmap.title, 120),
      summary: text(roadmap.summary, 300),
      phases: Array.isArray(roadmap.phases) ? roadmap.phases.slice(0, 6).map((p) => text(p, 40)) : [],
      nodes: roadmap.nodes.slice(0, 24),
    },
    known: Array.isArray(data.known) ? data.known.filter((k) => typeof k === 'string').slice(0, 60) : [],
    hours: Math.min(Math.max(Number(data.hours) || 8, 1), 80),
    budget: data.budget ? Math.min(Math.max(Math.round(Number(data.budget)) || 0, 0), 520) || '' : '',
  }
}
