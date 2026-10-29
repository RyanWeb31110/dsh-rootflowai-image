export declare const DEFAULT_PORT = 8794;
export declare const DEFAULT_BASE_URL = "https://us.rootflowai.com/v1";
/** Documented alternate. Set this explicitly; generations are not retried across hosts. */
export declare const PUBLIC_BASE_URL = "https://api.rootflowai.com/v1";
export declare const DEFAULT_MODEL = "gemini-3.1-flash-image-count";
export declare const DEFAULT_TIMEOUT_MS = 900000;
export declare const PLUGIN_NAME = "dsh-rootflowai-image";
export interface ImageConfig {
    host: string;
    port: number;
    token: string;
    apiKey: string;
    baseUrl: string;
    defaultModel: string;
    ipAssetsDir: string;
    cacheDir: string;
    timeoutMs: number;
    notionToken: string;
    notionParentPageId: string;
    notionDatabaseId: string;
    styleNote: string;
    refMap: Record<string, string>;
    maxBodyBytes: number;
}
export interface RawConfig {
    host?: unknown;
    port?: unknown;
    token?: unknown;
    apiKey?: unknown;
    baseUrl?: unknown;
    defaultModel?: unknown;
    ipAssetsDir?: unknown;
    cacheDir?: unknown;
    timeoutMs?: unknown;
    notionToken?: unknown;
    notionParentPageId?: unknown;
    notionDatabaseId?: unknown;
    styleNote?: unknown;
    refMap?: unknown;
    maxBodyBytes?: unknown;
}
export declare function dshHome(env?: NodeJS.ProcessEnv): string;
export declare function defaultCacheDir(env?: NodeJS.ProcessEnv): string;
export declare function secretFilePath(env?: NodeJS.ProcessEnv): string;
/** Parse a KEY=VALUE file. Missing file returns {}. Does not touch process.env. */
export declare function readSecretFile(file: string): Record<string, string>;
/**
 * Secret file first, then `env` wins. The CLI uses this. `apply` does not:
 * desktop Electron must receive literals in the profile patch.
 */
export declare function envWithSecretFile(env?: NodeJS.ProcessEnv): NodeJS.ProcessEnv;
export declare function maskSecret(value: string): string;
export declare function normalizeConfig(input?: RawConfig, env?: NodeJS.ProcessEnv): ImageConfig;
export declare function loadConfigFromEnv(env?: NodeJS.ProcessEnv): ImageConfig;
export declare function isLoopbackHost(host: string): boolean;
//# sourceMappingURL=config.d.ts.map