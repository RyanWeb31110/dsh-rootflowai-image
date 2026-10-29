/** Error that maps onto an HTTP status and a stable `error` code. */
export class ImageError extends Error {
    status;
    code;
    constructor(status, code, message) {
        super(message ?? code);
        this.name = 'ImageError';
        this.status = status;
        this.code = code;
    }
}
export function errorMessage(error) {
    if (error instanceof Error && error.message)
        return error.message;
    return 'unknown';
}
export function asImageError(error) {
    if (error instanceof ImageError)
        return error;
    return new ImageError(500, 'internal', errorMessage(error));
}
//# sourceMappingURL=errors.js.map