const youtubeHosts = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'])
const videoIdPattern = /^[A-Za-z0-9_-]{11}$/

function httpsUrl(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 4096) return null
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' || url.username || url.password || url.hash || (url.port && url.port !== '443')) return null
    return url
  } catch { return null }
}

/** Syntax and canonical identity only; never proves that a video is public/available. */
export function parseYouTubeUrl(value) {
  const url = httpsUrl(value)
  if (!url || !youtubeHosts.has(url.hostname)) return null
  let videoId
  if (url.hostname === 'youtu.be') videoId = url.pathname.match(/^\/([A-Za-z0-9_-]{11})\/?$/)?.[1]
  else if (url.pathname === '/watch' && url.searchParams.getAll('v').length === 1) videoId = url.searchParams.get('v')
  else videoId = url.pathname.match(/^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})\/?$/)?.[1]
  if (!videoIdPattern.test(videoId ?? '')) return null
  return { provider: 'youtube', videoId, url: `https://www.youtube.com/watch?v=${videoId}` }
}

export function parseVideoSource(value, { supportsYouTube = false } = {}) {
  const url = httpsUrl(value)
  if (!url) return null
  if (youtubeHosts.has(url.hostname)) return supportsYouTube ? parseYouTubeUrl(value) : null
  try {
    if (!/\.(mp4|mov)$/i.test(decodeURIComponent(url.pathname))) return null
    return { provider: 'direct', url: url.href }
  } catch { return null }
}
