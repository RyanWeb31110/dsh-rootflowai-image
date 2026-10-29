import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { isLoopbackHost } from './config.js';
import { asImageError, ImageError } from './errors.js';
import { PLUGIN_NAME } from './config.js';
function secretsMatch(provided, expected) {
    const left = createHash('sha256').update(provided).digest();
    const right = createHash('sha256').update(expected).digest();
    return timingSafeEqual(left, right);
}
function bearerToken(header) {
    if (typeof header !== 'string')
        return undefined;
    const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
    return match?.[1];
}
function authorized(header, expectedToken) {
    if (!expectedToken)
        return false;
    const provided = bearerToken(header);
    if (provided === undefined)
        return false;
    return secretsMatch(provided, expectedToken);
}
function loopbackOrigin(origin) {
    if (!origin)
        return undefined;
    try {
        const url = new URL(origin);
        if (url.protocol !== 'http:' && url.protocol !== 'https:')
            return undefined;
        if (!isLoopbackHost(url.hostname))
            return undefined;
        return origin;
    }
    catch {
        return undefined;
    }
}
function send(req, res, status, body) {
    const payload = JSON.stringify(body);
    const headers = {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
    };
    const origin = loopbackOrigin(typeof req.headers.origin === 'string' ? req.headers.origin : undefined);
    if (origin) {
        headers['access-control-allow-origin'] = origin;
        headers['access-control-allow-headers'] = 'authorization, content-type';
        headers['access-control-allow-methods'] = 'GET, POST, OPTIONS';
        headers.vary = 'Origin';
    }
    res.writeHead(status, headers);
    if (status === 204) {
        res.end();
        return;
    }
    res.end(payload);
}
function readBody(req, max) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        let settled = false;
        const fail = (error) => {
            if (settled)
                return;
            settled = true;
            reject(error);
        };
        req.on('data', (chunk) => {
            if (settled)
                return;
            size += chunk.length;
            if (size > max) {
                req.pause();
                fail(new ImageError(413, 'payload_too_large', 'JSON body is too large'));
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => {
            if (settled)
                return;
            settled = true;
            resolve(Buffer.concat(chunks).toString('utf8'));
        });
        req.on('error', () => fail(new ImageError(400, 'invalid_body', 'Could not read the request body')));
    });
}
async function parseJson(req, max) {
    const contentType = req.headers['content-type'] ?? '';
    if (!String(contentType).includes('application/json')) {
        throw new ImageError(415, 'invalid_body', 'Content-Type must be application/json');
    }
    const raw = await readBody(req, max);
    if (raw.trim() === '')
        throw new ImageError(400, 'invalid_json', 'Request body is empty');
    try {
        const value = JSON.parse(raw);
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            throw new ImageError(400, 'invalid_body', 'JSON body must be an object');
        }
        return value;
    }
    catch (error) {
        if (error instanceof ImageError)
            throw error;
        throw new ImageError(400, 'invalid_json', 'Request body is not JSON');
    }
}
function requireAuth(req, config) {
    if (!config.token) {
        if (isLoopbackHost(config.host))
            return;
        throw new ImageError(401, 'unauthorized', 'Set a token before binding a non-loopback host');
    }
    const header = Array.isArray(req.headers.authorization) ? req.headers.authorization[0] : req.headers.authorization;
    if (!authorized(header, config.token))
        throw new ImageError(401, 'unauthorized', 'Bearer token was rejected');
}
function stringList(value) {
    if (value === undefined)
        return undefined;
    if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
        throw new ImageError(400, 'invalid_body', 'images must be an array of strings');
    }
    return value;
}
function optionalString(value) {
    if (value === undefined || value === null || value === '')
        return undefined;
    if (typeof value !== 'string')
        throw new ImageError(400, 'invalid_body', 'Expected a string field');
    return value;
}
function optionalCount(value) {
    if (value === undefined || value === null || value === '')
        return undefined;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new ImageError(400, 'invalid_n', 'n must be an integer from 1 to 4; prefer 1');
    }
    return value;
}
export function createHttpServer(config, service, logger) {
    return createServer((req, res) => {
        void handle(req, res, config, service, logger);
    });
}
async function handle(req, res, config, service, logger) {
    try {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1');
        const pathname = url.pathname;
        const method = req.method ?? 'GET';
        if (method === 'OPTIONS') {
            send(req, res, 204, {});
            return;
        }
        if (pathname === '/health') {
            if (method !== 'GET')
                throw new ImageError(405, 'method_not_allowed', 'Use GET /health');
            send(req, res, 200, service.health());
            return;
        }
        requireAuth(req, config);
        if (pathname === '/v1/generate' && method === 'POST') {
            const body = await parseJson(req, config.maxBodyBytes);
            const prompt = optionalString(body.prompt);
            if (!prompt)
                throw new ImageError(400, 'empty_prompt', 'prompt is required');
            const result = await service.generate({
                prompt,
                model: optionalString(body.model),
                size: optionalString(body.size),
                quality: optionalString(body.quality),
                n: optionalCount(body.n),
                images: stringList(body.images),
                includeRaw: body.includeRaw === true,
                slotId: optionalString(body.slotId),
                articleTitle: optionalString(body.articleTitle),
                deliverNotion: body.deliverNotion === true,
                dryRun: body.dryRun === true,
            });
            send(req, res, 200, result);
            return;
        }
        if (pathname === '/v1/slots/generate' && method === 'POST') {
            const body = await parseJson(req, config.maxBodyBytes);
            if (body.slots !== undefined && !Array.isArray(body.slots)) {
                throw new ImageError(400, 'invalid_body', 'slots must be an array');
            }
            const result = await service.generateSlots({
                slots: body.slots,
                markdown: optionalString(body.markdown),
                articleTitle: optionalString(body.articleTitle),
                dryRun: body.dryRun === true,
                force: body.force === true,
                deliverNotion: body.deliverNotion === false ? false : undefined,
                model: optionalString(body.model),
                quality: optionalString(body.quality),
                includeRaw: body.includeRaw === true,
            });
            send(req, res, 200, result);
            return;
        }
        if (pathname === '/v1/slots/plan' && method === 'POST') {
            const body = await parseJson(req, config.maxBodyBytes);
            const markdown = optionalString(body.markdown);
            if (markdown === undefined)
                throw new ImageError(400, 'invalid_body', 'markdown is required');
            send(req, res, 200, { ok: true, slots: service.planSlots(markdown) });
            return;
        }
        if (pathname === '/v1/slots/strip' && method === 'POST') {
            const body = await parseJson(req, config.maxBodyBytes);
            const markdown = optionalString(body.markdown);
            if (markdown === undefined)
                throw new ImageError(400, 'invalid_body', 'markdown is required');
            send(req, res, 200, { ok: true, markdown: service.stripSlotsForPublish(markdown) });
            return;
        }
        throw new ImageError(404, 'not_found', `No route for ${method} ${pathname}`);
    }
    catch (error) {
        if (res.headersSent || res.writableEnded)
            return;
        const image = asImageError(error);
        if (image.status >= 500)
            logger.warn(`http ${image.status} ${image.code}`);
        send(req, res, image.status, { ok: false, error: image.code, message: image.message });
        if (image.status === 413)
            req.destroy();
    }
}
export function listen(server, host, port) {
    return new Promise((resolve, reject) => {
        const onError = (error) => {
            server.off('error', onError);
            reject(error);
        };
        server.once('error', onError);
        server.listen(port, host, () => {
            server.off('error', onError);
            const address = server.address();
            resolve(typeof address === 'object' && address ? address.port : port);
        });
    });
}
export function closeServer(server) {
    return new Promise((resolve, reject) => {
        if (!server.listening) {
            resolve();
            return;
        }
        server.close((error) => (error ? reject(error) : resolve()));
    });
}
export async function startHttpServer(options) {
    const { config, service, logger } = options;
    if (!config.token && !isLoopbackHost(config.host)) {
        logger.warn('token is empty and host is not loopback; /v1 requests will be rejected');
    }
    if (!config.apiKey)
        logger.warn('api key is empty; generate calls will fail until it is set');
    const server = createHttpServer(config, service, logger);
    const port = await listen(server, config.host, config.port);
    logger.info(`${PLUGIN_NAME} listening on http://${config.host}:${port}`);
    return {
        port,
        close: () => closeServer(server),
    };
}
//# sourceMappingURL=http.js.map