#!/usr/bin/env node
/**
 * One-shot generator and a loopback server for curl.
 * This process is not required when the Cordis plugin is already running inside dsh.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { envWithSecretFile, loadConfigFromEnv, secretFilePath } from './config.js'
import { ImageError } from './errors.js'
import { startHttpServer } from './http.js'
import { pluginLogger } from './logger.js'
import { createImageService } from './service.js'

interface CliArgs {
  help: boolean
  serve: boolean
  json: boolean
  dryRun: boolean
  force: boolean
  ip: boolean
  deliverNotion: boolean
  write: boolean
  prompt?: string
  model?: string
  size?: string
  quality?: string
  slot?: string
  ref?: string
  markdown?: string
  articleTitle?: string
  images: string[]
}

function take(args: string[], index: number, flag: string): string {
  const value = args[index]
  if (value === undefined || value.startsWith('--')) {
    throw new ImageError(400, 'invalid_args', `Missing value for ${flag}`)
  }
  return value
}

function parseArgv(argv: string[]): CliArgs {
  const out: CliArgs = {
    help: false,
    serve: false,
    json: false,
    dryRun: false,
    force: false,
    ip: false,
    deliverNotion: false,
    write: false,
    images: [],
  }
  const args = argv.slice(2)
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--help' || arg === '-h') out.help = true
    else if (arg === '--serve') out.serve = true
    else if (arg === '--json') out.json = true
    else if (arg === '--dry-run') out.dryRun = true
    else if (arg === '--force') out.force = true
    else if (arg === '--ip') out.ip = true
    else if (arg === '--deliver-notion') out.deliverNotion = true
    else if (arg === '--write') out.write = true
    else if (arg === '--prompt') out.prompt = take(args, ++index, arg)
    else if (arg === '--model') out.model = take(args, ++index, arg)
    else if (arg === '--size') out.size = take(args, ++index, arg)
    else if (arg === '--quality') out.quality = take(args, ++index, arg)
    else if (arg === '--slot') out.slot = take(args, ++index, arg)
    else if (arg === '--ref') out.ref = take(args, ++index, arg)
    else if (arg === '--markdown') out.markdown = take(args, ++index, arg)
    else if (arg === '--title') out.articleTitle = take(args, ++index, arg)
    else if (arg === '--image') out.images.push(take(args, ++index, arg))
    else throw new ImageError(400, 'invalid_args', `Unknown argument ${arg ?? ''}`)
  }
  return out
}

function helpText(): string {
  return `dsh-rootflowai-image-gen — RootFlowAI count-based article illustrations

Usage
  dsh-rootflowai-image-gen --prompt "窗边的书桌" --size 16:9 --json
  dsh-rootflowai-image-gen --prompt "封面" --ip --ref front,smile --size 2.35:1
  dsh-rootflowai-image-gen --markdown draft.md --dry-run --json
  dsh-rootflowai-image-gen --markdown draft.md --write
  dsh-rootflowai-image-gen --serve

Options
  --prompt TEXT       Scene or full prompt. "-" reads stdin.
  --model NAME        Count model. Default gemini-3.1-flash-image-count.
  --size SIZE         Ratio or pixels. 2.35:1 maps to 21:9.
  --quality LEVEL     low, medium, or high. Ignored for Gemini.
  --image PATH|URL    Repeatable reference. Local paths must be absolute.
  --ip                Wrap --prompt with the Qingshan character lock.
  --ref KEYS          Comma-separated pack refs used with --ip.
  --slot ID           Cache filename id.
  --markdown FILE     Plan ILLUST markers and generate them in order.
  --title TEXT        Article title passed into the IP prompt and Notion.
  --dry-run           Shape the request and do not call RootFlow.
  --force             Regenerate slots that already have status ok.
  --deliver-notion    Create a Notion page. The CLI never does this unless you pass the flag.
  --write             With --markdown, write updated markers back to the file.
  --json              Print the full JSON result.
  --serve             Listen on 127.0.0.1 for the local HTTP API.
  --help

Secrets
  The CLI reads ${secretFilePath()} when a variable is unset.
  Values already in the environment win. The dsh plugin does not read that
  file; desktop Electron needs literals in the profile cordis.patch.yml.
`
}

async function readPrompt(value: string | undefined): Promise<string | undefined> {
  if (value !== '-') return value
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8').trim()
}

async function main(): Promise<void> {
  const args = parseArgv(process.argv)
  if (args.help || (process.argv.length <= 2)) {
    console.log(helpText())
    return
  }
  const config = loadConfigFromEnv(envWithSecretFile(process.env))
  const logger = pluginLogger({}, 'dsh-rootflowai-image')
  const service = createImageService(config, { logger })

  if (args.serve) {
    const running = await startHttpServer({ config, service, logger })
    const shutdown = (): void => {
      void running.close().then(() => process.exit(0))
    }
    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
    return
  }

  if (args.markdown) {
    const markdown = readFileSync(args.markdown, 'utf8')
    const result = await service.generateSlots({
      markdown,
      articleTitle: args.articleTitle,
      dryRun: args.dryRun,
      force: args.force,
      model: args.model,
      quality: args.quality,
      deliverNotion: args.deliverNotion,
    })
    if (args.write && result.markdown !== undefined) writeFileSync(args.markdown, result.markdown)
    if (args.json || args.dryRun) console.log(JSON.stringify(result, null, 2))
    else {
      for (const slot of result.slots) {
        console.log(`${slot.id}\t${slot.status}\t${slot.imageUrl ?? slot.error ?? ''}`)
      }
    }
    if (result.failedCount > 0) process.exitCode = 1
    return
  }

  const promptText = await readPrompt(args.prompt)
  if (!promptText) throw new ImageError(400, 'empty_prompt', 'Pass --prompt or --markdown')
  let prompt = promptText
  let images = args.images
  if (args.ip) {
    const { buildIpPrompt, resolveRefFiles } = await import('./ip.js')
    const { parseRefList } = await import('./slots.js')
    const ref = args.ref ?? ''
    const slot = {
      id: args.slot || 'cli',
      type: 'inline' as const,
      ratio: args.size || '16:9',
      ref,
      mood: '',
      note: promptText,
      status: 'pending' as const,
    }
    prompt = buildIpPrompt(slot, { articleTitle: args.articleTitle, styleNote: config.styleNote })
    const files = resolveRefFiles(parseRefList(ref), { ipAssetsDir: config.ipAssetsDir, refMap: config.refMap })
    images = [...files, ...images]
  }
  const result = await service.generate({
    prompt,
    model: args.model,
    size: args.size,
    quality: args.quality,
    images,
    slotId: args.slot,
    articleTitle: args.articleTitle,
    dryRun: args.dryRun,
    deliverNotion: args.deliverNotion,
  })
  if (args.json || args.dryRun) console.log(JSON.stringify(result, null, 2))
  else if (result.url) console.log(result.url)
  else console.log(JSON.stringify(result, null, 2))
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exit(1)
})
