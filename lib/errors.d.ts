/** Error that maps onto an HTTP status and a stable `error` code. */
export declare class ImageError extends Error {
    readonly status: number;
    readonly code: string;
    constructor(status: number, code: string, message?: string);
}
export declare function errorMessage(error: unknown): string;
export declare function asImageError(error: unknown): ImageError;
//# sourceMappingURL=errors.d.ts.map