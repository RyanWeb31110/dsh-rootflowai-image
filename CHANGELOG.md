# Changelog

## 0.1.0 — 2026-10-29

First release. Article illustrations through RootFlowAI's count-based image API, saved locally for hand publish. Nothing is posted to 小红书, 公众号, or X.

### P0

- `POST /v1/generate` calls `POST /v1/images/generations` for text-to-image and public URL references, and `POST /v1/images/edits` as multipart when any reference is a local file.
- Default model `gemini-3.1-flash-image-count`. Gemini requests omit `quality`. GPT count models accept `low`, `medium`, and `high`, including the `hd-count` and `4k-count` aliases.
- `2.35:1` and the `cover` alias map to `21:9`. GPT 4K rejects sizes outside its six wide ratios.
- Upstream read timeout defaults to 900 seconds. `n` defaults to 1.
- `GET /health` reports version, base URL, default model, and a masked key.
- CLI `dsh-rootflowai-image-gen` for a one-shot generate, a markdown slot batch, or `--serve`.
- ILLUST marker library: `planSlots`, `stripSlotsForPublish`, `renderMarker`, `applySlotUpdates`.
- Unit tests mock `fetch`. No API key is required or committed.

### P1

- Qingshan IP prompt builder locks the character (about 35, short crop, black semi-rim glasses, square-round face, pine-green jacket, off-white tee, rock-gray cargo pants, gray-white sneakers; not chibi, not Q-version, not feminine).
- `ref` keys resolve to files under `ipAssetsDir`. Built-in names such as `front` → `02_front.png` are overridden by the pack `README.md` / `REFS.md` and by config `refMap`.
- `POST /v1/slots/generate` runs slots sequentially, skips `status=ok` unless `force`, and supports `dryRun`.
- CDN results are saved under `$DSH_HOME/media-illust` (default `~/.dsh/media-illust`) as `<slot id>-<hash>.<ext>`. A download failure keeps the CDN `imageUrl` and sets `cacheError`.
- Optional Notion delivery creates a child page or database row with the prompt, model, external image, and local path. A missing token returns `notionPayload`. A Notion error returns `notionError` and does not drop the image URL.
