import { cacheRemoteImage } from './cache.js';
import { createRootFlowClient } from './client.js';
import { maskSecret, PLUGIN_NAME } from './config.js';
import { ImageError, errorMessage } from './errors.js';
import { buildIpPrompt, resolveRefFiles } from './ip.js';
import { deliverIllustration } from './notion.js';
import { applySlotUpdates, coerceSlot, parseRefList, planSlots, stripSlotsForPublish, } from './slots.js';
import { VERSION } from './version.js';
function noopLogger() {
    return { info() { }, warn() { } };
}
function slotsFromBatch(input) {
    const fromMarkdown = typeof input.markdown === 'string' ? planSlots(input.markdown) : [];
    const rawSlots = input.slots ?? [];
    if (fromMarkdown.length === 0 && rawSlots.length === 0) {
        throw new ImageError(400, 'empty_slots', 'Provide slots or markdown with ILLUST markers');
    }
    if (fromMarkdown.length === 0)
        return rawSlots.map((slot) => coerceSlot(slot));
    const byId = new Map(fromMarkdown.map((slot) => [slot.id, { ...slot }]));
    const order = fromMarkdown.map((slot) => slot.id);
    for (const raw of rawSlots) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
            throw new ImageError(400, 'invalid_slot', 'slot must be an object');
        }
        const record = raw;
        const id = typeof record.id === 'string' ? record.id.trim() : '';
        if (!id)
            throw new ImageError(400, 'invalid_slot', 'slot id is required');
        const base = byId.get(id) ?? coerceSlot({ id, type: record.type ?? 'inline' });
        byId.set(id, overlaySlot(base, record));
        if (!order.includes(id))
            order.push(id);
    }
    return order.flatMap((id) => {
        const slot = byId.get(id);
        return slot ? [slot] : [];
    });
}
function overlaySlot(base, raw) {
    const next = { ...base };
    if (raw.type === 'cover' || raw.type === 'inline' || raw.type === 'end')
        next.type = raw.type;
    if (typeof raw.ratio === 'string' && raw.ratio.trim())
        next.ratio = raw.ratio.trim();
    if (typeof raw.ref === 'string')
        next.ref = raw.ref.trim();
    else if (Array.isArray(raw.ref))
        next.ref = raw.ref.map((entry) => String(entry).trim()).filter(Boolean).join(',');
    if (typeof raw.mood === 'string')
        next.mood = raw.mood.trim();
    if (typeof raw.note === 'string')
        next.note = raw.note.trim();
    if (typeof raw.prompt === 'string' && raw.prompt.trim())
        next.prompt = raw.prompt.trim();
    if (typeof raw.imageUrl === 'string' && raw.imageUrl.trim())
        next.imageUrl = raw.imageUrl.trim();
    if (typeof raw.localPath === 'string' && raw.localPath.trim())
        next.localPath = raw.localPath.trim();
    if (isSlotStatus(raw.status))
        next.status = raw.status;
    return next;
}
function isSlotStatus(value) {
    return value === 'pending' || value === 'ok' || value === 'error' || value === 'skipped' || value === 'dry-run';
}
function redactedRequest(call, apiKeyConfigured) {
    return {
        endpoint: call.endpoint,
        url: call.url,
        model: call.model,
        size: call.size,
        requestedSize: call.requestedSize,
        n: call.n,
        quality: call.quality,
        imageCount: call.imageCount,
        authorization: apiKeyConfigured ? 'configured' : 'missing',
        json: call.json,
        warnings: call.warnings,
    };
}
export function createImageService(config, deps = {}) {
    const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
    const logger = deps.logger ?? noopLogger();
    const client = createRootFlowClient({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        defaultModel: config.defaultModel,
        timeoutMs: config.timeoutMs,
        fetchImpl,
    });
    function health() {
        return {
            ok: true,
            name: PLUGIN_NAME,
            version: VERSION,
            baseUrl: config.baseUrl,
            defaultModel: config.defaultModel,
            apiKey: maskSecret(config.apiKey),
            apiKeyConfigured: config.apiKey.trim().length > 0,
            ipAssetsDir: config.ipAssetsDir,
            cacheDir: config.cacheDir,
            notionConfigured: Boolean(config.notionToken.trim()) && Boolean(config.notionParentPageId.trim() || config.notionDatabaseId.trim()),
        };
    }
    async function maybeNotion(input, generated) {
        if (input.deliverNotion !== true)
            return {};
        const result = await deliverIllustration({
            token: config.notionToken,
            parentPageId: config.notionParentPageId,
            databaseId: config.notionDatabaseId,
            fetchImpl,
        }, {
            title: input.articleTitle
                ? `${input.articleTitle} · ${input.slotId ?? '插图'}`
                : `插图 ${input.slotId ?? ''}`.trim(),
            prompt: generated.prompt,
            model: generated.model,
            size: generated.size,
            imageUrl: generated.url,
            localPath: generated.localPath,
            slotId: input.slotId,
            articleTitle: input.articleTitle,
        });
        if (result.notionError)
            logger.warn(`notion delivery failed: ${result.notionError}`);
        return {
            notionPageUrl: result.pageUrl,
            notionError: result.notionError,
            notionPayload: result.delivered ? undefined : result.payload,
        };
    }
    async function generate(input) {
        const prompt = input.prompt?.trim() ?? '';
        if (input.dryRun) {
            const shaped = await client.shape({ ...input, prompt });
            const described = redactedRequest(shaped, config.apiKey.trim().length > 0);
            return {
                ok: true,
                dryRun: true,
                model: shaped.model,
                size: shaped.size,
                requestedSize: shaped.requestedSize,
                elapsedMs: 0,
                endpoint: shaped.endpoint,
                warnings: shaped.warnings,
                request: described,
            };
        }
        const generated = await client.generate({ ...input, prompt });
        const cached = await cacheRemoteImage({
            url: generated.url,
            cacheDir: config.cacheDir,
            id: input.slotId || 'gen',
            fetchImpl,
        });
        const notion = await maybeNotion(input, {
            url: generated.url,
            model: generated.model,
            size: generated.size,
            prompt,
            localPath: cached.localPath,
        });
        return {
            ok: true,
            url: generated.url,
            urls: generated.urls,
            model: generated.model,
            size: generated.size,
            requestedSize: generated.requestedSize,
            elapsedMs: generated.elapsedMs,
            endpoint: generated.endpoint,
            warnings: generated.warnings,
            localPath: cached.localPath,
            cacheError: cached.cacheError,
            raw: generated.raw,
            ...notion,
        };
    }
    async function generateSlots(input) {
        const slots = slotsFromBatch(input);
        const started = Date.now();
        const out = [];
        for (const slot of slots) {
            if (!input.force && slot.status === 'ok' && slot.imageUrl) {
                out.push({ ...slot, skipped: true });
                continue;
            }
            const refKeys = parseRefList(slot.ref);
            let prompt = slot.prompt;
            try {
                prompt = buildIpPrompt(slot, {
                    articleTitle: input.articleTitle,
                    styleNote: config.styleNote,
                    refKeys,
                });
                const files = resolveRefFiles(refKeys, { ipAssetsDir: config.ipAssetsDir, refMap: config.refMap });
                const result = await generate({
                    prompt,
                    model: input.model,
                    size: slot.ratio,
                    quality: input.quality,
                    n: 1,
                    images: files,
                    includeRaw: input.includeRaw,
                    slotId: slot.id,
                    deliverNotion: input.deliverNotion !== false,
                    articleTitle: input.articleTitle,
                    dryRun: input.dryRun,
                });
                if (result.dryRun) {
                    out.push({
                        ...slot,
                        prompt,
                        status: 'dry-run',
                        model: result.model,
                        size: result.size,
                        requestedSize: result.requestedSize,
                        warnings: result.warnings,
                        request: result.request,
                    });
                    continue;
                }
                out.push({
                    ...slot,
                    prompt,
                    status: 'ok',
                    imageUrl: result.url,
                    urls: result.urls,
                    localPath: result.localPath,
                    model: result.model,
                    size: result.size,
                    requestedSize: result.requestedSize,
                    elapsedMs: result.elapsedMs,
                    cacheError: result.cacheError,
                    warnings: result.warnings,
                    notionPageUrl: result.notionPageUrl,
                    notionError: result.notionError,
                    notionPayload: result.notionPayload,
                    error: undefined,
                    skipped: false,
                });
            }
            catch (error) {
                logger.warn(`slot ${slot.id} failed: ${errorMessage(error)}`);
                out.push({
                    ...slot,
                    prompt,
                    status: 'error',
                    error: error instanceof ImageError ? `${error.code}: ${error.message}` : errorMessage(error),
                });
            }
        }
        return {
            ok: true,
            slots: out,
            markdown: typeof input.markdown === 'string' ? applySlotUpdates(input.markdown, out) : undefined,
            failedCount: out.filter((slot) => slot.status === 'error').length,
            elapsedMs: Date.now() - started,
        };
    }
    return { health, generate, generateSlots, planSlots, stripSlotsForPublish };
}
//# sourceMappingURL=service.js.map