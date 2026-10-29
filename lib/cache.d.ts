export interface CacheResult {
    localPath?: string;
    cacheError?: string;
}
/** Save a CDN or data-URI result under cacheDir. A download failure does not drop the CDN url. */
export declare function cacheRemoteImage(options: {
    url: string;
    cacheDir: string;
    id: string;
    fetchImpl?: typeof fetch;
}): Promise<CacheResult>;
//# sourceMappingURL=cache.d.ts.map