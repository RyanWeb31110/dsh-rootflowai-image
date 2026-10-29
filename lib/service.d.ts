import { type GenerateInput } from './client.js';
import type { ImageConfig } from './config.js';
import { PLUGIN_NAME } from './config.js';
import type { Logger } from './logger.js';
import { planSlots, stripSlotsForPublish, type IllustSlot } from './slots.js';
export interface ServiceDeps {
    fetchImpl?: typeof fetch;
    logger?: Logger;
}
export interface HealthInfo {
    ok: true;
    name: typeof PLUGIN_NAME;
    version: string;
    baseUrl: string;
    defaultModel: string;
    apiKey: string;
    apiKeyConfigured: boolean;
    ipAssetsDir: string;
    cacheDir: string;
    notionConfigured: boolean;
}
export interface GenerateRequest extends GenerateInput {
    slotId?: string;
    deliverNotion?: boolean;
    articleTitle?: string;
    dryRun?: boolean;
}
export interface GenerateResult {
    ok: true;
    dryRun?: boolean;
    url?: string;
    urls?: string[];
    model: string;
    size: string;
    requestedSize: string;
    elapsedMs: number;
    endpoint: 'generations' | 'edits';
    warnings: string[];
    localPath?: string;
    cacheError?: string;
    raw?: unknown;
    notionPageUrl?: string;
    notionError?: string;
    notionPayload?: unknown;
    request?: Record<string, unknown>;
}
export interface SlotBatchRequest {
    slots?: unknown[];
    markdown?: string;
    articleTitle?: string;
    dryRun?: boolean;
    force?: boolean;
    deliverNotion?: boolean;
    model?: string;
    quality?: string;
    includeRaw?: boolean;
}
export interface SlotBatchResult {
    ok: true;
    slots: IllustSlot[];
    markdown?: string;
    failedCount: number;
    elapsedMs: number;
}
export declare function createImageService(config: ImageConfig, deps?: ServiceDeps): {
    health: () => HealthInfo;
    generate: (input: GenerateRequest) => Promise<GenerateResult>;
    generateSlots: (input: SlotBatchRequest) => Promise<SlotBatchResult>;
    planSlots: typeof planSlots;
    stripSlotsForPublish: typeof stripSlotsForPublish;
};
export type ImageService = ReturnType<typeof createImageService>;
//# sourceMappingURL=service.d.ts.map