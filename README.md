# dsh-rootflowai-image

**RootFlowAI 计次生图。** DeepSeek Harness plugin that turns article drafts into illustrations through [RootFlowAI's count-based image API](https://rootflowai.com/docs/guide/image-generation), then saves the files for hand publish.

作者 [@QingShanLab](https://github.com/QingShanLab)。同一套 Cordis 插件写法见 [dsh-grok-bridge](https://github.com/RyanWeb31110/dsh-grok-bridge)。

The owner keeps a personal IP pack (青山, about 35, pine-green work jacket) and wants cover and inline art for articles. This package is the image service. `dsh-media-workbench` and a shell can call it. It does not post to 小红书, 公众号, or X, and it does not ship the PNG pack.

Requires Node.js 22.19+ and DeepSeek Harness 0.2.x (`engines.dsh`: `>=0.2.0 <0.3.0`).

## Install

From a checkout, after `npm install && npm run build`:

```sh
dsh plugin --profile web add /absolute/path/to/dsh-rootflowai-image
```

Use `desktop` instead of `web` for the Electron app. The published package name is `dsh-rootflowai-image`. The bundle manifest points at `cordis.patch.yml`, which **inserts** one row:

```yaml
- insert:
    - id: dsh-rootflowai-image
      name: dsh-rootflowai-image
      config:
        host: !!js process.env.ROOTFLOWAI_IMAGE_BIND ?? '127.0.0.1'
        port: !!js Number(process.env.ROOTFLOWAI_IMAGE_PORT ?? 8794)
        apiKey: !!js process.env.ROOTFLOWAI_IMAGE_API_KEY ?? ''
        baseUrl: !!js process.env.ROOTFLOWAI_IMAGE_BASE_URL ?? 'https://us.rootflowai.com/v1'
        defaultModel: !!js process.env.ROOTFLOWAI_IMAGE_DEFAULT_MODEL ?? 'gemini-3.1-flash-image-count'
        ipAssetsDir: !!js process.env.ROOTFLOWAI_IP_ASSETS_DIR ?? ''
```

The full shipped patch is [cordis.patch.yml](cordis.patch.yml). A later patch that targets this `id` replaces the **whole** config, so restate every key. `name` must stay `dsh-rootflowai-image`.

`dsh --profile web --dump-config` should list the row. Quit and reopen the desktop app after changing its patch. Remove with `dsh plugin --profile web remove dsh-rootflowai-image`.

## Secrets

No key lives in this repo. The process reads config or the environment:

| Config | Environment | Default |
|---|---|---|
| `apiKey` | `ROOTFLOWAI_IMAGE_API_KEY` | empty |
| `baseUrl` | `ROOTFLOWAI_IMAGE_BASE_URL` | `https://us.rootflowai.com/v1` |
| `defaultModel` | `ROOTFLOWAI_IMAGE_DEFAULT_MODEL` | `gemini-3.1-flash-image-count` |
| `ipAssetsDir` | `ROOTFLOWAI_IP_ASSETS_DIR` | empty |
| `cacheDir` | `ROOTFLOWAI_IMAGE_CACHE_DIR` | `$DSH_HOME/media-illust` |
| `host` / `port` | `ROOTFLOWAI_IMAGE_BIND` / `ROOTFLOWAI_IMAGE_PORT` | `127.0.0.1` / `8794` |
| `token` | `ROOTFLOWAI_IMAGE_HTTP_TOKEN` | empty (open on loopback) |
| `timeoutMs` | `ROOTFLOWAI_IMAGE_TIMEOUT_MS` | `900000` |
| `notionToken` | `NOTION_TOKEN` | empty |
| `notionParentPageId` | `NOTION_PARENT_PAGE_ID` | empty |
| `notionDatabaseId` | `NOTION_DATABASE_ID` | empty |
| `styleNote` | `ROOTFLOWAI_IMAGE_STYLE_NOTE` | built-in 晨纸暖阅 palette |

Put the real values in `~/.dsh/secrets/rootflowai-image.env` (or `$DSH_HOME/secrets/rootflowai-image.env`). Start from [.env.example](.env.example). Do not commit that filled file.

`dsh web` sees the shell. Source the file, then start:

```sh
set -a
source ~/.dsh/secrets/rootflowai-image.env
set +a
dsh web
```

An env-shaped patch is in [examples/cordis.patch.env.yml](examples/cordis.patch.env.yml).

**Desktop Electron does not see that environment.** `launchctl setenv` is the wrong tool. Paste literals into `~/.dsh/profiles/desktop/cordis.patch.yml`. Copy the template at [examples/cordis.patch.yml](examples/cordis.patch.yml) and fill `apiKey` there. The plugin does not open the secrets file; only the CLI does, and only when a variable is still unset.

The owner's test host is `https://us.rootflowai.com/v1`. The public host `https://api.rootflowai.com/v1` is the alternate you set in `baseUrl`. A failed generation is not retried on the other host, because a lost response may already have been billed. Create the key in the **Gemini 绘图** group for Gemini count models, or **GPT 绘图** for GPT count models. The wrong group returns an error and is not billed.

`ipAssetsDir` stays empty until you point it at the pack. On the owner's machine that directory is `/Users/ryan/Documents/qingshan_IP_assets_v1`. The PNGs are not in this repo.

## Local API

The plugin listens on `127.0.0.1:8794` inside `dsh`. Without `dsh`:

```sh
npm run build
node lib/cli.js --serve
```

`GET /health` has no auth. Other routes accept an optional bearer when `token` is set. An empty token is allowed only on loopback. Browser callers on `http://127.0.0.1:*` or `http://localhost:*` get CORS; other origins do not.

### Health

```sh
curl -sS http://127.0.0.1:8794/health
```

```json
{
  "ok": true,
  "name": "dsh-rootflowai-image",
  "version": "0.1.0",
  "baseUrl": "https://us.rootflowai.com/v1",
  "defaultModel": "gemini-3.1-flash-image-count",
  "apiKey": "tes…ok",
  "apiKeyConfigured": true
}
```

The key is masked. An empty key is `""`.

### Generate

`POST /v1/generate`

```sh
curl -sS http://127.0.0.1:8794/v1/generate \
  -H 'content-type: application/json' \
  -d '{"prompt":"窗边的书桌，暖色留白","size":"16:9","quality":"low","model":"gpt-image-2-count"}'
```

```json
{
  "ok": true,
  "url": "https://cdn.example/result.png",
  "urls": ["https://cdn.example/result.png"],
  "model": "gpt-image-2-count",
  "size": "16:9",
  "requestedSize": "16:9",
  "elapsedMs": 42000,
  "endpoint": "generations",
  "localPath": "/Users/me/.dsh/media-illust/gen-ab12cd34ef56.png"
}
```

`images` is a list of HTTPS URLs, data URIs, or absolute local paths. URLs and data URIs go to `POST /v1/images/generations` as JSON `image: string[]`. Any absolute local path switches the call to `POST /v1/images/edits` as `multipart/form-data` with repeated `image` files. Relative paths are rejected. `n` defaults to 1 and is capped at 4. Gemini models drop `quality` and add a warning. Pass `"includeRaw": true` to keep the upstream JSON. Pass `"deliverNotion": true` to also create a Notion page. Pass `"dryRun": true` to see the shaped request without spending a count.

A cache or Notion failure does not remove `url`. Look at `cacheError` or `notionError`.

### Slots

`POST /v1/slots/plan` with `{ "markdown" }` returns the markers.

`POST /v1/slots/strip` returns the publish copy.

`POST /v1/slots/generate` accepts `{ "markdown" }` and/or `{ "slots": [...] }`, plus `articleTitle`, `dryRun`, `force`, `model`, `quality`. Slots run one at a time. A slot with `status: "ok"` and an `imageUrl` is skipped unless `force` is true. The HTTP API delivers to Notion when a token and a parent are configured, unless `deliverNotion` is false.

```sh
curl -sS http://127.0.0.1:8794/v1/slots/generate \
  -H 'content-type: application/json' \
  -d '{"markdown":"<!-- ILLUST id=i1 type=cover ratio=2.35:1 mood=sunny note=书桌 -->","articleTitle":"harness","dryRun":true}'
```

`dryRun` fills `prompt` and `request` and does not call RootFlow.

## CLI

```sh
node lib/cli.js --prompt "窗边的书桌" --size 16:9 --quality low --model gpt-image-2-count --json
node lib/cli.js --prompt "封面短句" --ip --ref front,smile --size 2.35:1 --slot i1
node lib/cli.js --markdown examples/draft.md --dry-run --json
node lib/cli.js --markdown examples/draft.md --write --deliver-notion
```

`examples/draft.md` uses `ref=front`. A dry run still resolves those files, so set `ROOTFLOWAI_IP_ASSETS_DIR` first or the slots return `missing_ip_assets_dir` and the process exits 1. `--ip` together with `--ref` has the same requirement. `--ip` alone only writes the character lock.

```sh
node lib/cli.js --prompt "窗边的书桌，不要参考图" --ip --size 2.35:1 --dry-run --json
```

`--ip` wraps the prompt with the character lock and attaches pack files for `--ref`. `--write` updates markers in the markdown file. The CLI creates Notion pages only with `--deliver-notion`. `--serve` is the loopback API above. The bin name after install is `dsh-rootflowai-image-gen`.

## Slot markers

Markers are HTML comments. Publish copy must not contain them. `stripSlotsForPublish` removes `ILLUST` comments and leaves every other comment alone.

```html
<!-- ILLUST id=i1 type=cover|inline|end ratio=2.35:1|16:9|1:1 ref=front|smile mood=sunny note="窗边的书桌" -->
```

| Field | Meaning |
|---|---|
| `id` | Required. `[A-Za-z0-9_-]+`. |
| `type` | `cover`, `inline`, or `end`. Default `inline`. |
| `ratio` | Passed to `size`. Default `2.35:1` for cover, `16:9` for inline, `1:1` for end. |
| `ref` | Pack keys, separated by commas or `\|`. |
| `mood` | Short mood word. |
| `note` | Scene brief. Quote it when it contains spaces. |
| `prompt` | Filled by the IP builder after a generate. |
| `imageUrl` | CDN URL after success. |
| `localPath` | Cached file. |
| `status` | `pending`, `ok`, `error`, `dry-run`. `ok` plus `imageUrl` is skipped next time. |

A slot object is `{ id, type, ratio, ref, mood, note, prompt?, imageUrl?, localPath?, status }`. `planSlots(markdown)` reads them. `applySlotUpdates(markdown, slots)` rewrites matching ids and appends new ones. [examples/draft.md](examples/draft.md) is a short draft.

In process, other plugins can import `planSlots`, `stripSlotsForPublish`, `buildIpPrompt`, and `createImageService` from `dsh-rootflowai-image`.

## Sizes

RootFlow accepts OpenAI pixels and ratio strings. This plugin maps a few aliases before the call.

| You send | API receives | Why |
|---|---|---|
| `2.35:1` | `21:9` | 2.35 is closer to 21:9 (2.333) than to 2:1 or to 16:9. |
| `2.39:1` | `21:9` | Anamorphic, same mapping. |
| `cover` | `21:9` | Cover alias for a wide banner. |
| `1:1` | `1:1` | Pixel equivalent `1024x1024`. |
| `3:2` / `2:3` | same | `1536x1024` / `1024x1536`. |
| `16:9` / `9:16` | same | `1792x1024` / `1024x1792`. |
| `1024x1024`, `1536x1024`, `1024x1536`, `1792x1024`, `1024x1792` | unchanged | Standard pixels. |
| `4:3`, `3:4`, `5:4`, `4:5`, `2:1`, `1:2`, `21:9`, `9:21` | unchanged | Ratio strings. |

`1792x1024` is 16:9. It is not used as a stand-in for 2.35:1.

GPT-Image-2 4K (`gpt-image-2-4k-count` or the alias `4k-count`) only accepts `16:9`, `9:16`, `2:1`, `1:2`, `21:9`, and `9:21`. A square 4K request fails locally and is not sent. Gemini 3.1 also accepts `1:4`, `4:1`, `1:8`, and `8:1`.

Model aliases: `hd-count` → `gpt-image-2-hd-count`, `4k-count` → `gpt-image-2-4k-count`.

## Qingshan IP

`buildIpPrompt` always locks the same person: male, about 35, short crop, black semi-rim glasses, square-round face, pine-green work jacket, off-white tee, rock-gray cargo pants, gray-white sneakers, mature and natural. It forbids chibi, exaggerated Q-version, and a feminine face. The default palette is 晨纸暖阅 (warm ivory, 雾岩蓝, 蜜杏). `styleNote` replaces that palette only.

The scene comes from `note`. The ratio is sent as `size`, not repeated in the prompt. Reference order is the `ref` list. Absolute pack paths are not written into the prompt.

Resolution order for each key:

1. Config `refMap`.
2. `REFS.md`, then `README.md`, in `ipAssetsDir`. Tables (`| smile | 05_expression_smile.png |`) and `smile → 05_expression_smile.png` both work. An explicit row must exist on disk.
3. Built-in name, if that file exists.
4. A single image filename in the pack that contains the key.

Built-in fallback when the pack README has no row:

| Key | File |
|---|---|
| `three`, `turnaround`, `composite` | `00_three_views_composite.png` |
| `side`, `profile` | `01_side.png` |
| `front` | `02_front.png` |
| `back` | `03_back.png` |
| `portrait`, `face` | `04_portrait.png` |
| `smile` | `05_expression_smile.png` |
| `neutral` | `06_expression_neutral.png` |
| `think`, `thinking` | `07_expression_think.png` |
| `serious` | `08_expression_serious.png` |
| `talk` | `09_expression_talk.png` |
| `outfit` | `10_outfit_full.png` |
| `glasses` | `11_detail_glasses.png` |

If your pack uses different filenames, put them in its README. Those rows win.

## Cache

Successful CDN URLs are downloaded to `cacheDir`. The filename is `<slot id>-<sha256 of the url, 12 hex>.<ext>`. One-shot generates use the id `gen` unless `slotId` is set. Both `imageUrl` (CDN) and `localPath` are returned. CDN links can expire; the local file is the copy you publish from. A failed download sets `cacheError` and still returns `imageUrl`.

## Notion

Optional. Set `notionToken` and either `notionParentPageId` or `notionDatabaseId`. A database id wins when both are set. The plugin looks up the database title property, then creates a row. A parent page gets a child page. The body contains the article title, slot id, model, size, prompt, an external image embed, a bookmark of the CDN URL, and the local path.

If the token or parent is missing, the response includes `notionPayload` and does not call Notion. If Notion returns an error, the image result stays, with `notionError` and the same payload so you can retry. Slot batches from the HTTP API try this when Notion is configured. `POST /v1/generate` tries it only when `deliverNotion` is true.

## Cost

Billing is per successful image. Failures are not billed. Prices below are the SVIP reference on the docs page and can change. Check [the image guide](https://rootflowai.com/docs/guide/image-generation) before a batch.

| Model | Tier | Reference |
|---|---|---|
| `gpt-image-2-count` | 1K | $0.10 |
| `gpt-image-2-hd-count` | 2K | $0.20 |
| `gpt-image-2-4k-count` | 4K | $0.40 |
| `gemini-3.1-flash-image-count` | 1K | $0.30 |
| `gemini-3.1-flash-image-hd-count` | 2K | $0.40 |
| `gemini-3.1-flash-image-4k-count` | 4K | $0.55 |

GPT quality levels cost the same. `low` is the preview (often 30–60s). `high` is the finished frame (often 50–120s). Gemini has no `quality` field; pick the model tier instead. Prefer one `low` GPT preview to check the crop, then one Gemini 3.1 Flash count with the IP refs for the frame you will publish. Keep `n` at 1. Slots already run sequentially. Generation often takes 30–150 seconds, and 4K sits at the long end. The client waits up to 900 seconds. If a proxy idle-cuts at 60 seconds, the URL never arrives; raise that timeout or bypass the proxy.

## Later: media workbench

This repo does not draw canvas cards. A workbench can call the loopback API:

- `POST http://127.0.0.1:8794/v1/slots/plan` while editing a draft
- `POST http://127.0.0.1:8794/v1/slots/generate` with `dryRun: true` before spending a count
- `POST http://127.0.0.1:8794/v1/generate` for a single frame
- `POST http://127.0.0.1:8794/v1/slots/strip` on the way to the publish paste

Hand publish stays outside this package.

## Modules

| Module | Role |
|---|---|
| `src/client.ts` | RootFlow generations and edits. |
| `src/slots.ts` | Marker parse, strip, inject. |
| `src/ip.ts` | Character prompt and ref files. |
| `src/cache.ts` | CDN download. |
| `src/notion.ts` | Optional delivery page. |
| `src/http.ts`, `src/index.ts` | Loopback API and Cordis `apply`. |
| `src/cli.ts` | `dsh-rootflowai-image-gen`. |

## Development

```sh
npm install
npm test
npm run build
```

`npm test` builds `lib/` and runs the unit tests with mocked `fetch`. It does not call RootFlow or Notion. Node 22.19 or newer is required.
