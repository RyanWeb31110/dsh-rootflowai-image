import { type RawConfig } from './config.js';
import { Config } from './schema.js';
export declare const name = "dsh-rootflowai-image";
export { Config };
export interface PluginContext {
    effect?(disposer: () => void): void;
    logger?: unknown;
}
/**
 * In-process DeepSeek Harness plugin.
 * Starts a loopback HTTP API and exposes the same service to other plugins.
 */
export declare function apply(ctx: PluginContext, rawConfig?: RawConfig): void;
export { normalizeConfig, loadConfigFromEnv, maskSecret, secretFilePath, readSecretFile, envWithSecretFile } from './config.js';
export type { ImageConfig, RawConfig } from './config.js';
export { createRootFlowClient, shapeGenerateRequest } from './client.js';
export type { GenerateInput, GenerateOutput, ShapedCall } from './client.js';
export { planSlots, stripSlotsForPublish, renderMarker, applySlotUpdates, parseRefList, coerceSlot } from './slots.js';
export type { IllustSlot, SlotType, SlotStatus } from './slots.js';
export { buildIpPrompt, resolveRefFiles, parseRefMapMarkdown, BUILTIN_REF_FILES, CHARACTER_LOCK, IP_LOCK_MARK } from './ip.js';
export { deliverIllustration, buildNotionPayload, normalizeNotionId } from './notion.js';
export { cacheRemoteImage } from './cache.js';
export { createImageService } from './service.js';
export { startHttpServer } from './http.js';
export { resolveSize, SIZE_ALIASES, MODEL_ALIASES, PIXEL_FOR_RATIO } from './sizes.js';
export { ImageError } from './errors.js';
export { VERSION } from './version.js';
//# sourceMappingURL=index.d.ts.map