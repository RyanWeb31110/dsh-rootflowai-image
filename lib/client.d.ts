export interface ClientOptions {
    apiKey: string;
    baseUrl: string;
    defaultModel: string;
    timeoutMs: number;
    fetchImpl?: typeof fetch;
}
export interface GenerateInput {
    prompt: string;
    model?: string;
    size?: string;
    quality?: string;
    n?: number;
    /** HTTPS URLs, data URIs, or absolute local paths. */
    images?: string[];
    includeRaw?: boolean;
}
export interface GenerateOutput {
    ok: true;
    url: string;
    urls: string[];
    model: string;
    size: string;
    requestedSize: string;
    elapsedMs: number;
    endpoint: 'generations' | 'edits';
    warnings: string[];
    raw?: unknown;
}
export interface ShapedCall {
    endpoint: 'generations' | 'edits';
    url: string;
    headers: Record<string, string>;
    body: string | Uint8Array;
    json?: Record<string, unknown>;
    model: string;
    size: string;
    requestedSize: string;
    n: number;
    quality?: 'low' | 'medium' | 'high';
    warnings: string[];
    imageCount: number;
}
/**
 * Decide generations JSON vs edits multipart and build the exact outbound call.
 * Local files always use multipart `/images/edits`. URL and data-URI references
 * stay on JSON `/images/generations` until a local file is also present.
 */
export declare function shapeGenerateRequest(options: ClientOptions, input: GenerateInput, fetchImpl?: typeof fetch): Promise<ShapedCall>;
export declare function createRootFlowClient(options: ClientOptions): {
    generate: (input: GenerateInput) => Promise<GenerateOutput>;
    shape: (input: GenerateInput) => Promise<ShapedCall>;
};
export type RootFlowClient = ReturnType<typeof createRootFlowClient>;
//# sourceMappingURL=client.d.ts.map