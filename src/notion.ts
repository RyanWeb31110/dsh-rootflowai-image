import { errorMessage } from './errors.js'

const NOTION_VERSION = '2022-06-28'
const NOTION_ROOT = 'https://api.notion.com/v1'

export interface NotionDeliveryInput {
  title: string
  prompt: string
  model: string
  size: string
  imageUrl: string
  localPath?: string
  slotId?: string
  articleTitle?: string
}

export interface NotionPayload {
  parent: { page_id: string } | { database_id: string }
  properties: Record<string, unknown>
  children: NotionBlock[]
}

interface NotionBlock {
  object: 'block'
  type: string
  [key: string]: unknown
}

export interface NotionDeliveryResult {
  delivered: boolean
  pageId?: string
  pageUrl?: string
  notionError?: string
  payload: NotionPayload
}

interface NotionSettings {
  token: string
  parentPageId: string
  databaseId: string
  fetchImpl?: typeof fetch
}

export function normalizeNotionId(value: string): string {
  const compact = value.trim().replace(/-/g, '')
  const matches = compact.match(/[0-9a-fA-F]{32}/g)
  const raw = matches?.[matches.length - 1]?.toLowerCase()
  if (!raw) return value.trim()
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`
}

function richText(content: string): Array<{ type: 'text'; text: { content: string } }> {
  const text = content.slice(0, 8_000)
  const chunks: Array<{ type: 'text'; text: { content: string } }> = []
  for (let index = 0; index < text.length; index += 1_800) {
    chunks.push({ type: 'text', text: { content: text.slice(index, index + 1_800) } })
  }
  if (chunks.length === 0) chunks.push({ type: 'text', text: { content: '' } })
  return chunks
}

function paragraph(content: string): NotionBlock {
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: { rich_text: richText(content) },
  }
}

function titleProperty(title: string): Record<string, unknown> {
  return { title: [{ type: 'text', text: { content: title.slice(0, 200) } }] }
}

export function buildNotionPayload(input: NotionDeliveryInput, parent: NotionPayload['parent'], titleKey = 'title'): NotionPayload {
  const heading = input.title.trim().slice(0, 200) || '插图'
  const children: NotionBlock[] = [
    paragraph([
      input.articleTitle ? `文章：${input.articleTitle}` : '',
      input.slotId ? `槽位：${input.slotId}` : '',
      `模型：${input.model}`,
      `尺寸：${input.size}`,
    ].filter(Boolean).join('\n')),
    paragraph(input.prompt),
  ]
  if (/^https?:\/\//i.test(input.imageUrl)) {
    children.push({
      object: 'block',
      type: 'image',
      image: { type: 'external', external: { url: input.imageUrl } },
    })
    children.push({
      object: 'block',
      type: 'bookmark',
      bookmark: { url: input.imageUrl },
    })
  }
  children.push(paragraph(input.localPath
    ? `本地文件：${input.localPath}`
    : '本地文件：尚未下载。CDN 链接见上方。'))
  return {
    parent,
    properties: { [titleKey]: titleProperty(heading) },
    children,
  }
}

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  }
}

async function titlePropertyName(databaseId: string, token: string, fetchImpl: typeof fetch): Promise<string> {
  const response = await fetchImpl(`${NOTION_ROOT}/databases/${databaseId}`, { headers: headers(token) })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`Notion database lookup HTTP ${response.status}: ${text.slice(0, 240)}`)
  }
  const body = JSON.parse(text) as { properties?: Record<string, { type?: string }> }
  const found = Object.entries(body.properties ?? {}).find(([, value]) => value?.type === 'title')
  if (!found) throw new Error('Notion database has no title property')
  return found[0]
}

/**
 * Create a child page or database row. Missing credentials return the payload
 * and do not throw. A Notion HTTP failure is reported on `notionError`.
 */
export async function deliverIllustration(
  settings: NotionSettings,
  input: NotionDeliveryInput,
): Promise<NotionDeliveryResult> {
  const fetchImpl = settings.fetchImpl ?? globalThis.fetch
  const databaseId = settings.databaseId.trim() ? normalizeNotionId(settings.databaseId) : ''
  const parentPageId = settings.parentPageId.trim() ? normalizeNotionId(settings.parentPageId) : ''
  const parent: NotionPayload['parent'] = databaseId
    ? { database_id: databaseId }
    : { page_id: parentPageId }
  const token = settings.token.trim()
  const configured = Boolean(token) && (Boolean(databaseId) || Boolean(parentPageId))
  if (!configured) {
    const titleKey = databaseId ? 'Name' : 'title'
    return { delivered: false, payload: buildNotionPayload(input, parent, titleKey) }
  }
  try {
    const titleKey = databaseId
      ? await titlePropertyName(databaseId, token, fetchImpl)
      : 'title'
    const payload = buildNotionPayload(input, parent, titleKey)
    const response = await fetchImpl(`${NOTION_ROOT}/pages`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify(payload),
    })
    const text = await response.text()
    let body: { id?: string; url?: string; message?: string } = {}
    try {
      body = text ? JSON.parse(text) as typeof body : {}
    } catch {
      body = {}
    }
    if (!response.ok) {
      return {
        delivered: false,
        notionError: body.message || `Notion HTTP ${response.status}: ${text.slice(0, 240)}`,
        payload,
      }
    }
    return { delivered: true, pageId: body.id, pageUrl: body.url, payload }
  } catch (error) {
    const titleKey = databaseId ? 'Name' : 'title'
    return {
      delivered: false,
      notionError: errorMessage(error).slice(0, 400),
      payload: buildNotionPayload(input, parent, titleKey),
    }
  }
}
