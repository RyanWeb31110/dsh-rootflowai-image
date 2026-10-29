import { normalizeConfig, PLUGIN_NAME } from './config.js';
import { startHttpServer } from './http.js';
import { pluginLogger } from './logger.js';
import { createImageService } from './service.js';
import { Config } from './schema.js';
export const name = PLUGIN_NAME;
export { Config };
/**
 * In-process DeepSeek Harness plugin.
 * Starts a loopback HTTP API and exposes the same service to other plugins.
 */
export function apply(ctx, rawConfig = {}) {
    const config = normalizeConfig(rawConfig);
    const logger = pluginLogger(ctx, name);
    const service = createImageService(config, { logger });
    const start = () => {
        let stopped = false;
        let close;
        void startHttpServer({ config, service, logger }).then((running) => {
            close = () => running.close();
            if (stopped)
                void close();
        }).catch((error) => {
            logger.warn(`failed to listen: ${error instanceof Error ? error.message : 'unknown'}`);
        });
        return () => {
            stopped = true;
            void close?.();
        };
    };
    if (typeof ctx.effect === 'function')
        ctx.effect(start);
    else
        start();
}
export { normalizeConfig, loadConfigFromEnv, maskSecret, secretFilePath, readSecretFile, envWithSecretFile } from './config.js';
export { createRootFlowClient, shapeGenerateRequest } from './client.js';
export { planSlots, stripSlotsForPublish, renderMarker, applySlotUpdates, parseRefList, coerceSlot } from './slots.js';
export { buildIpPrompt, resolveRefFiles, parseRefMapMarkdown, BUILTIN_REF_FILES, CHARACTER_LOCK, IP_LOCK_MARK } from './ip.js';
export { deliverIllustration, buildNotionPayload, normalizeNotionId } from './notion.js';
export { cacheRemoteImage } from './cache.js';
export { createImageService } from './service.js';
export { startHttpServer } from './http.js';
export { resolveSize, SIZE_ALIASES, MODEL_ALIASES, PIXEL_FOR_RATIO } from './sizes.js';
export { ImageError } from './errors.js';
export { VERSION } from './version.js';
//# sourceMappingURL=index.js.map