import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageError, errorMessage } from './errors.js';
import { isGeminiModel, qualityForModel, resolveCount, resolveModel, resolveSize, } from './sizes.js';
import { VERSION } from './version.js';
const MAX_IMAGES = 16;
const GEMINI_IMAGE_HINT = 14;
const MAX_REFERENCE_BYTES = 20 * 1024 * 1024;
function joinUrl(base, suffix) {
    return `${base.replace(/\/+$/, '')}/${suffix.replace(/^\/+/, '')}`;
}
function contentTypeFor(filename) {
    const ext = path.extname(filename).toLowerCase();
    if (ext === '.png')
        return 'image/png';
    if (ext === '.jpg' || ext === '.jpeg')
        return 'image/jpeg';
    if (ext === '.webp')
        return 'image/webp';
    if (ext === '.gif')
        return 'image/gif';
    return 'application/octet-stream';
}
function parseDataUri(uri) {
    const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(uri);
    if (!match)
        throw new ImageError(400, 'invalid_image', 'Image data URI could not be parsed');
    const contentType = match[1] || 'application/octet-stream';
    const payload = match[3] ?? '';
    const bytes = match[2]
        ? Buffer.from(payload, 'base64')
        : Buffer.from(decodeURIComponent(payload), 'utf8');
    if (bytes.length === 0 || bytes.length > MAX_REFERENCE_BYTES) {
        throw new ImageError(400, 'invalid_image', 'Image data URI is empty or larger than 20MB');
    }
    const ext = contentType.includes('jpeg') ? 'jpg' : contentType.includes('webp') ? 'webp' : 'png';
    return { filename: `reference.${ext}`, contentType, bytes };
}
async function readLocal(file) {
    if (!path.isAbsolute(file)) {
        throw new ImageError(400, 'image_path_not_absolute', `Image path must be absolute: ${file}`);
    }
    let bytes;
    try {
        bytes = await readFile(file);
    }
    catch {
        throw new ImageError(400, 'missing_image_file', `Image file does not exist: ${file}`);
    }
    if (bytes.length === 0 || bytes.length > MAX_REFERENCE_BYTES) {
        throw new ImageError(400, 'invalid_image', `Image file is empty or larger than 20MB: ${file}`);
    }
    return {
        filename: path.basename(file),
        contentType: contentTypeFor(file),
        bytes,
    };
}
async function downloadReference(url, fetchImpl, timeoutMs) {
    let response;
    try {
        response = await fetchImpl(url, { signal: AbortSignal.timeout(Math.min(timeoutMs, 60_000)) });
    }
    catch (error) {
        throw new ImageError(502, 'reference_fetch_failed', errorMessage(error));
    }
    if (!response.ok) {
        throw new ImageError(502, 'reference_fetch_failed', `Reference image returned HTTP ${response.status}`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_REFERENCE_BYTES) {
        throw new ImageError(400, 'invalid_image', 'Reference image is empty or larger than 20MB');
    }
    let filename = 'reference.png';
    try {
        const base = path.basename(new URL(url).pathname);
        if (base && base !== '/' && base.length < 120)
            filename = base;
    }
    catch {
        filename = 'reference.png';
    }
    const headerType = response.headers.get('content-type')?.split(';')[0]?.trim();
    return {
        filename,
        contentType: headerType || contentTypeFor(filename),
        bytes,
    };
}
function encodeMultipart(fields, files) {
    const boundary = `dshRootflow${randomBytes(12).toString('hex')}`;
    const chunks = [];
    for (const [name, value] of Object.entries(fields)) {
        chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
    }
    for (const file of files) {
        chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`));
        chunks.push(file.bytes);
        chunks.push(Buffer.from('\r\n'));
    }
    chunks.push(Buffer.from(`--${boundary}--\r\n`));
    return {
        body: new Uint8Array(Buffer.concat(chunks)),
        contentType: `multipart/form-data; boundary=${boundary}`,
    };
}
/**
 * Decide generations JSON vs edits multipart and build the exact outbound call.
 * Local files always use multipart `/images/edits`. URL and data-URI references
 * stay on JSON `/images/generations` until a local file is also present.
 */
export async function shapeGenerateRequest(options, input, fetchImpl = options.fetchImpl ?? globalThis.fetch) {
    const prompt = input.prompt?.trim() ?? '';
    if (!prompt)
        throw new ImageError(400, 'empty_prompt', 'prompt is required');
    if (prompt.length > 20_000)
        throw new ImageError(400, 'prompt_too_large', 'prompt is longer than 20000 characters');
    const model = resolveModel(input.model, options.defaultModel);
    const { size, requestedSize } = resolveSize(input.size, model);
    const n = resolveCount(input.n);
    const quality = qualityForModel(model, input.quality);
    const warnings = [];
    if (n > 1)
        warnings.push('n greater than 1 spends one count per image; prefer separate requests');
    if (input.quality?.trim() && !quality) {
        warnings.push(isGeminiModel(model)
            ? 'quality is ignored for Gemini count models; choose a 1K, hd, or 4k model instead'
            : 'quality is only sent for GPT image count models');
    }
    const images = (input.images ?? []).map((entry) => entry.trim()).filter(Boolean);
    if (images.length > MAX_IMAGES) {
        throw new ImageError(400, 'too_many_images', `at most ${MAX_IMAGES} reference images`);
    }
    if (isGeminiModel(model) && images.length > GEMINI_IMAGE_HINT) {
        warnings.push(`Gemini count models are documented for at most ${GEMINI_IMAGE_HINT} reference images`);
    }
    const remote = [];
    const files = [];
    let sawLocal = false;
    for (const image of images) {
        if (image.startsWith('data:')) {
            if (sawLocal)
                files.push(parseDataUri(image));
            else
                remote.push(image);
            continue;
        }
        if (/^https?:\/\//i.test(image)) {
            if (sawLocal)
                files.push(await downloadReference(image, fetchImpl, options.timeoutMs));
            else
                remote.push(image);
            continue;
        }
        sawLocal = true;
        files.push(await readLocal(image));
    }
    if (sawLocal && remote.length > 0) {
        const converted = [];
        for (const image of remote) {
            converted.push(image.startsWith('data:')
                ? parseDataUri(image)
                : await downloadReference(image, fetchImpl, options.timeoutMs));
        }
        files.unshift(...converted);
        remote.length = 0;
    }
    const headers = {
        Authorization: `Bearer ${options.apiKey}`,
        Accept: 'application/json',
        'User-Agent': `dsh-rootflowai-image/${VERSION}`,
    };
    if (!sawLocal) {
        const json = { model, prompt, n, size };
        if (quality)
            json.quality = quality;
        if (remote.length > 0)
            json.image = remote;
        headers['Content-Type'] = 'application/json';
        return {
            endpoint: 'generations',
            url: joinUrl(options.baseUrl, 'images/generations'),
            headers,
            body: JSON.stringify(json),
            json,
            model,
            size,
            requestedSize,
            n,
            quality,
            warnings,
            imageCount: remote.length,
        };
    }
    const fields = {
        model,
        prompt,
        n: String(n),
        size,
    };
    if (quality)
        fields.quality = quality;
    const encoded = encodeMultipart(fields, files);
    headers['Content-Type'] = encoded.contentType;
    return {
        endpoint: 'edits',
        url: joinUrl(options.baseUrl, 'images/edits'),
        headers,
        body: encoded.body,
        model,
        size,
        requestedSize,
        n,
        quality,
        warnings,
        imageCount: files.length,
    };
}
function urlsFromPayload(payload) {
    if (!payload || typeof payload !== 'object') {
        throw new ImageError(502, 'upstream_empty', 'RootFlow returned a body that is not JSON');
    }
    const data = payload.data;
    if (!Array.isArray(data) || data.length === 0) {
        const message = payload.error?.message;
        throw new ImageError(502, 'upstream_empty', message || 'RootFlow returned no image data');
    }
    const urls = [];
    for (const item of data) {
        if (typeof item?.url === 'string' && item.url.trim()) {
            urls.push(item.url.trim());
            continue;
        }
        if (typeof item?.b64_json === 'string' && item.b64_json.trim()) {
            urls.push(`data:image/png;base64,${item.b64_json.trim()}`);
        }
    }
    if (urls.length === 0)
        throw new ImageError(502, 'upstream_empty', 'RootFlow image data had no url');
    return { urls, raw: payload };
}
export function createRootFlowClient(options) {
    const fetchImpl = options.fetchImpl ?? globalThis.fetch;
    async function generate(input) {
        if (!options.apiKey.trim()) {
            throw new ImageError(400, 'missing_api_key', 'Set ROOTFLOWAI_IMAGE_API_KEY or config apiKey');
        }
        const shaped = await shapeGenerateRequest(options, input, fetchImpl);
        const started = Date.now();
        let response;
        try {
            response = await fetchImpl(shaped.url, {
                method: 'POST',
                headers: shaped.headers,
                body: shaped.body,
                signal: AbortSignal.timeout(options.timeoutMs),
            });
        }
        catch (error) {
            const name = error instanceof Error ? error.name : '';
            if (name === 'TimeoutError' || name === 'AbortError') {
                throw new ImageError(504, 'upstream_timeout', `RootFlow timed out after ${options.timeoutMs}ms`);
            }
            throw new ImageError(502, 'upstream_unreachable', errorMessage(error));
        }
        const text = await response.text();
        let parsed;
        try {
            parsed = text ? JSON.parse(text) : undefined;
        }
        catch {
            parsed = undefined;
        }
        if (!response.ok) {
            const message = parsed && typeof parsed === 'object'
                ? parsed.error?.message
                : undefined;
            throw new ImageError(502, 'upstream_error', message || `RootFlow HTTP ${response.status}: ${text.slice(0, 300)}`);
        }
        const { urls, raw } = urlsFromPayload(parsed);
        const first = urls[0];
        if (!first)
            throw new ImageError(502, 'upstream_empty', 'RootFlow image data had no url');
        return {
            ok: true,
            url: first,
            urls,
            model: shaped.model,
            size: shaped.size,
            requestedSize: shaped.requestedSize,
            elapsedMs: Date.now() - started,
            endpoint: shaped.endpoint,
            warnings: shaped.warnings,
            raw: input.includeRaw ? raw : undefined,
        };
    }
    return { generate, shape: (input) => shapeGenerateRequest(options, input, fetchImpl) };
}
//# sourceMappingURL=client.js.map