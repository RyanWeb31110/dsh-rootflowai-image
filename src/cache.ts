import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const MAX_BYTES = 32 * 1024 * 1024

export interface CacheResult {
  localPath?: string
  cacheError?: string
}

function safeId(id: string): string {
  const cleaned = id.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48)
  return cleaned || 'gen'
}

function shortHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12)
}

function extensionFrom(url: string, contentType: string | null): string {
  if (url.startsWith('data:')) {
    if (url.startsWith('data:image/jpeg')) return 'jpg'
    if (url.startsWith('data:image/webp')) return 'webp'
    if (url.startsWith('data:image/gif')) return 'gif'
    return 'png'
  }
  try {
    const match = /\.(png|jpe?g|webp|gif)$/i.exec(new URL(url).pathname)
    const ext = match?.[1]?.toLowerCase()
    if (ext === 'jpeg') return 'jpg'
    if (ext) return ext
  } catch {
    /* non-URL results fall through to content-type */
  }
  if (contentType?.includes('jpeg')) return 'jpg'
  if (contentType?.includes('webp')) return 'webp'
  if (contentType?.includes('gif')) return 'gif'
  return 'png'
}

function decodeDataUri(url: string): Buffer | undefined {
  const match = /^data:[^;,]+;base64,([A-Za-z0-9+/=\s]+)$/s.exec(url)
  if (!match?.[1]) return undefined
  return Buffer.from(match[1], 'base64')
}

/** Save a CDN or data-URI result under cacheDir. A download failure does not drop the CDN url. */
export async function cacheRemoteImage(options: {
  url: string
  cacheDir: string
  id: string
  fetchImpl?: typeof fetch
}): Promise<CacheResult> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  let bytes: Buffer | undefined
  let contentType: string | null = null
  if (options.url.startsWith('data:')) {
    bytes = decodeDataUri(options.url)
    if (!bytes) return { cacheError: 'data_uri_not_base64' }
  } else if (!/^https?:\/\//i.test(options.url)) {
    return { cacheError: 'unsupported_image_url' }
  } else {
    try {
      const response = await fetchImpl(options.url, { signal: AbortSignal.timeout(120_000), redirect: 'follow' })
      if (!response.ok) return { cacheError: `download_http_${response.status}` }
      contentType = response.headers.get('content-type')
      bytes = Buffer.from(await response.arrayBuffer())
    } catch (error) {
      const message = error instanceof Error ? error.message : 'download failed'
      return { cacheError: message.slice(0, 200) }
    }
  }
  if (!bytes || bytes.length === 0) return { cacheError: 'empty_download' }
  if (bytes.length > MAX_BYTES) return { cacheError: 'download_too_large' }
  try {
    await mkdir(options.cacheDir, { recursive: true })
    const filename = `${safeId(options.id)}-${shortHash(options.url)}.${extensionFrom(options.url, contentType)}`
    const localPath = path.join(options.cacheDir, filename)
    await writeFile(localPath, bytes)
    return { localPath }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'cache write failed'
    return { cacheError: message.slice(0, 200) }
  }
}
