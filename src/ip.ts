import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { ImageError } from './errors.js'
import { parseRefList, type IllustSlot, type SlotType } from './slots.js'

/** Marker so a second pass can tell a built prompt from a short scene note. */
export const IP_LOCK_MARK = '青山 IP · V1.0'

/**
 * Built-in filenames for the owner's v1 pack. A README.md or REFS.md inside
 * `ipAssetsDir` overrides these rows. Config `refMap` overrides both.
 */
export const BUILTIN_REF_FILES: Record<string, string> = {
  three: '00_three_views_composite.png',
  turnaround: '00_three_views_composite.png',
  composite: '00_three_views_composite.png',
  side: '01_side.png',
  profile: '01_side.png',
  front: '02_front.png',
  back: '03_back.png',
  portrait: '04_portrait.png',
  face: '04_portrait.png',
  smile: '05_expression_smile.png',
  neutral: '06_expression_neutral.png',
  think: '07_expression_think.png',
  thinking: '07_expression_think.png',
  serious: '08_expression_serious.png',
  talk: '09_expression_talk.png',
  outfit: '10_outfit_full.png',
  glasses: '11_detail_glasses.png',
}

export const CHARACTER_LOCK = [
  `人物锁定（${IP_LOCK_MARK}，必须与参考图是同一个人，不要重新设计脸和衣服）：`,
  '成年男性，大约 35 岁，短寸发，黑色半框眼镜，方圆脸。',
  '松绿色工装外套，米白 T 恤，岩灰色工装裤，灰白运动鞋。',
  '气质成熟、阳光、自然。',
  '禁止 Q 版，禁止 chibi，禁止夸张大头，禁止女性化，禁止美少女脸。',
].join('\n')

export const DEFAULT_STYLE = [
  '半写实干净插画，轻松专业，晨纸暖阅。',
  '暖象牙白纸纹底，浅木与留白，雾岩蓝与蜜杏色块，柔和晨光。',
  '不要深色背景，不要渐变紫，不要赛博霓虹。',
].join('')

const TYPE_LINE: Record<SlotType, string> = {
  cover: '用途：公众号封面。信息少而大，适合头图。',
  inline: '用途：文内插图。帮助读者看懂这一节。',
  end: '用途：文末收束图。安静，留白多。',
}

const HEADER_KEYS = new Set(['ref', 'key', 'name', 'file', 'filename', 'path', '图片', '文件'])

/** Read `key → file` rows from a pack README. Tables and `key: file` lines both work. */
export function parseRefMapMarkdown(markdown: string): Record<string, string> {
  const map: Record<string, string> = {}
  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const table = /^\|\s*`?([A-Za-z][\w-]*)`?\s*\|\s*`?([^\s`|]+)`?\s*\|/.exec(trimmed)
    if (table?.[1] && table[2] && !HEADER_KEYS.has(table[1].toLowerCase())) {
      map[table[1]] = table[2]
      continue
    }
    const arrow = /^(?:[-*]\s+)?`?([A-Za-z][\w-]*)`?\s*(?:→|->|:)\s*`?([^\s`]+)`?\s*$/.exec(trimmed)
    if (arrow?.[1] && arrow[2] && !HEADER_KEYS.has(arrow[1].toLowerCase())) {
      map[arrow[1]] = arrow[2]
    }
  }
  return map
}

function readPackMap(dir: string): Record<string, string> {
  if (!dir) return {}
  const map: Record<string, string> = {}
  for (const name of ['README.md', 'REFS.md']) {
    const file = path.join(dir, name)
    if (!existsSync(file)) continue
    Object.assign(map, parseRefMapMarkdown(readFileSync(file, 'utf8')))
  }
  return map
}

function listImages(dir: string): string[] {
  try {
    return readdirSync(dir).filter((name) => /\.(png|jpe?g|webp)$/i.test(name))
  } catch {
    return []
  }
}

function scanForRef(dir: string, key: string): string | undefined {
  const images = listImages(dir)
  const needle = key.toLowerCase()
  const exact = images.find((name) => path.parse(name).name.toLowerCase() === needle)
  if (exact) return exact
  const hits = images.filter((name) => name.toLowerCase().includes(needle))
  return hits.length === 1 ? hits[0] : undefined
}

function joinPack(dir: string, file: string): string {
  return path.isAbsolute(file) ? file : path.join(dir, file)
}

function missingFile(key: string, file: string, dir: string): ImageError {
  const names = listImages(dir)
  const sample = names.slice(0, 30).join(', ') || '(no png/jpg/webp in the pack)'
  return new ImageError(
    400,
    'missing_ref_file',
    `Ref "${key}" expects ${file}. Images in the pack: ${sample}`,
  )
}

/**
 * Resolve ref keys to absolute image files.
 * Explicit pack or config rows must exist. Built-in names fall through to a
 * unique filename that contains the key when the guessed file is absent.
 */
export function resolveRefFiles(
  refs: readonly string[],
  options: { ipAssetsDir: string; refMap?: Record<string, string> },
): string[] {
  if (refs.length === 0) return []
  const dir = options.ipAssetsDir.trim()
  if (!dir) {
    throw new ImageError(400, 'missing_ip_assets_dir', 'Set ROOTFLOWAI_IP_ASSETS_DIR or config ipAssetsDir before using ref keys')
  }
  if (!existsSync(dir)) {
    throw new ImageError(400, 'missing_ip_assets_dir', `IP asset directory does not exist: ${dir}`)
  }
  const pack = readPackMap(dir)
  const config = options.refMap ?? {}
  const paths: string[] = []
  for (const key of refs) {
    if (Object.prototype.hasOwnProperty.call(config, key)) {
      const file = joinPack(dir, config[key] ?? '')
      if (!existsSync(file)) throw missingFile(key, file, dir)
      paths.push(file)
      continue
    }
    if (Object.prototype.hasOwnProperty.call(pack, key)) {
      const file = joinPack(dir, pack[key] ?? '')
      if (!existsSync(file)) throw missingFile(key, file, dir)
      paths.push(file)
      continue
    }
    const builtin = BUILTIN_REF_FILES[key]
    if (builtin) {
      const file = path.join(dir, builtin)
      if (existsSync(file)) {
        paths.push(file)
        continue
      }
    }
    if (key.includes('.') || key.includes('/') || key.includes('\\')) {
      const file = joinPack(dir, key)
      if (existsSync(file)) {
        paths.push(file)
        continue
      }
    }
    const scanned = scanForRef(dir, key)
    if (scanned) {
      paths.push(path.join(dir, scanned))
      continue
    }
    const expected = builtin ? path.join(dir, builtin) : path.join(dir, `${key}.png`)
    throw missingFile(key, expected, dir)
  }
  return paths
}

function sceneOf(slot: IllustSlot): string {
  const note = slot.note.trim()
  const prompt = slot.prompt?.trim() ?? ''
  const extra = prompt && !prompt.includes(IP_LOCK_MARK) ? prompt : ''
  const scene = [note, extra].filter(Boolean).join('\n')
  return scene || '文章配图。主体是青山，画面服务正文，不要另造一个角色。'
}

export function buildIpPrompt(
  slot: IllustSlot,
  options: { articleTitle?: string; styleNote?: string; refKeys?: readonly string[] } = {},
): string {
  const refs = options.refKeys ?? parseRefList(slot.ref)
  const style = options.styleNote?.trim() || DEFAULT_STYLE
  const lines = [
    style,
    '',
    CHARACTER_LOCK,
    'Not chibi, not super-deformed, not feminine, not a different person.',
    '',
    TYPE_LINE[slot.type],
    `画面：${sceneOf(slot)}`,
  ]
  if (slot.mood.trim()) lines.push(`情绪：${slot.mood.trim()}`)
  if (options.articleTitle?.trim()) {
    lines.push(`这是文章《${options.articleTitle.trim()}》的配图。不要把文章标题画进画面，除非画面说明里写了要出现的中文。`)
  }
  if (refs.length > 0) {
    lines.push(`参考图顺序：${refs.join(', ')}。以参考图的五官、眼镜、发型、服装为准，文字只作补充。`)
  } else {
    lines.push('这次没有参考图，仍按上面的人物锁定来画，不要换成别人。')
  }
  lines.push('画面里的中文要少、要大、要清晰，不能糊成乱码。不要在画面里写比例数字。不要品牌 Logo，不要水印，不要真实软件界面。')
  return lines.join('\n')
}
