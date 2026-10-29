import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { ImageError } from './errors.js';
export const DEFAULT_PORT = 8794;
export const DEFAULT_BASE_URL = 'https://us.rootflowai.com/v1';
/** Documented alternate. Set this explicitly; generations are not retried across hosts. */
export const PUBLIC_BASE_URL = 'https://api.rootflowai.com/v1';
export const DEFAULT_MODEL = 'gemini-3.1-flash-image-count';
export const DEFAULT_TIMEOUT_MS = 900_000;
export const PLUGIN_NAME = 'dsh-rootflowai-image';
function text(value, fallback = '') {
    return typeof value === 'string' ? value.trim() : fallback;
}
function integer(value, fallback) {
    if (typeof value === 'number' && Number.isFinite(value))
        return Math.trunc(value);
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (Number.isFinite(parsed))
            return Math.trunc(parsed);
    }
    return fallback;
}
export function dshHome(env = process.env) {
    const configured = env.DSH_HOME?.trim();
    return configured && configured.length > 0 ? configured : path.join(homedir(), '.dsh');
}
export function defaultCacheDir(env = process.env) {
    return path.join(dshHome(env), 'media-illust');
}
export function secretFilePath(env = process.env) {
    return path.join(dshHome(env), 'secrets', 'rootflowai-image.env');
}
/** Parse a KEY=VALUE file. Missing file returns {}. Does not touch process.env. */
export function readSecretFile(file) {
    if (!existsSync(file))
        return {};
    const out = {};
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#'))
            continue;
        const eq = trimmed.indexOf('=');
        if (eq <= 0)
            continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"') && value.length >= 2)
            || (value.startsWith("'") && value.endsWith("'") && value.length >= 2)) {
            value = value.slice(1, -1);
        }
        if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key))
            out[key] = value;
    }
    return out;
}
/**
 * Secret file first, then `env` wins. The CLI uses this. `apply` does not:
 * desktop Electron must receive literals in the profile patch.
 */
export function envWithSecretFile(env = process.env) {
    return { ...readSecretFile(secretFilePath(env)), ...env };
}
export function maskSecret(value) {
    const trimmed = value.trim();
    if (!trimmed)
        return '';
    if (trimmed.length <= 8)
        return '****';
    return `${trimmed.slice(0, 3)}…${trimmed.slice(-2)}`;
}
function refMapOf(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return {};
    const out = {};
    for (const [key, entry] of Object.entries(value)) {
        if (typeof entry !== 'string')
            continue;
        const name = key.trim();
        const file = entry.trim();
        if (name && file)
            out[name] = file;
    }
    return out;
}
export function normalizeConfig(input = {}, env = process.env) {
    const port = integer(input.port, DEFAULT_PORT);
    if (port < 0 || port > 65535) {
        throw new ImageError(400, 'invalid_port', `port ${port} is outside 0-65535`);
    }
    let timeoutMs = integer(input.timeoutMs, DEFAULT_TIMEOUT_MS);
    if (timeoutMs < 1000)
        timeoutMs = DEFAULT_TIMEOUT_MS;
    if (timeoutMs > 1_200_000)
        timeoutMs = 1_200_000;
    let maxBodyBytes = integer(input.maxBodyBytes, 20_971_520);
    if (maxBodyBytes < 1024)
        maxBodyBytes = 1024;
    if (maxBodyBytes > 32_000_000)
        maxBodyBytes = 32_000_000;
    const base = text(input.baseUrl);
    const cache = text(input.cacheDir);
    const assets = text(input.ipAssetsDir);
    const model = text(input.defaultModel);
    return {
        host: text(input.host, '127.0.0.1') || '127.0.0.1',
        port,
        token: text(input.token),
        apiKey: text(input.apiKey),
        baseUrl: (base || DEFAULT_BASE_URL).replace(/\/+$/, ''),
        defaultModel: model || DEFAULT_MODEL,
        ipAssetsDir: assets ? path.resolve(assets) : '',
        cacheDir: cache ? path.resolve(cache) : defaultCacheDir(env),
        timeoutMs,
        notionToken: text(input.notionToken),
        notionParentPageId: text(input.notionParentPageId),
        notionDatabaseId: text(input.notionDatabaseId),
        styleNote: text(input.styleNote),
        refMap: refMapOf(input.refMap),
        maxBodyBytes,
    };
}
export function loadConfigFromEnv(env = process.env) {
    return normalizeConfig({
        host: env.ROOTFLOWAI_IMAGE_BIND,
        port: env.ROOTFLOWAI_IMAGE_PORT,
        token: env.ROOTFLOWAI_IMAGE_HTTP_TOKEN,
        apiKey: env.ROOTFLOWAI_IMAGE_API_KEY,
        baseUrl: env.ROOTFLOWAI_IMAGE_BASE_URL,
        defaultModel: env.ROOTFLOWAI_IMAGE_DEFAULT_MODEL,
        ipAssetsDir: env.ROOTFLOWAI_IP_ASSETS_DIR,
        cacheDir: env.ROOTFLOWAI_IMAGE_CACHE_DIR,
        timeoutMs: env.ROOTFLOWAI_IMAGE_TIMEOUT_MS,
        notionToken: env.NOTION_TOKEN,
        notionParentPageId: env.NOTION_PARENT_PAGE_ID,
        notionDatabaseId: env.NOTION_DATABASE_ID,
        styleNote: env.ROOTFLOWAI_IMAGE_STYLE_NOTE,
    }, env);
}
export function isLoopbackHost(host) {
    const value = host.trim().toLowerCase();
    return value === '127.0.0.1' || value === 'localhost' || value === '::1';
}
//# sourceMappingURL=config.js.map