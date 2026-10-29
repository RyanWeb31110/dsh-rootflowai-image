/** Error that maps onto an HTTP status and a stable `error` code. */
export class ImageError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message?: string) {
    super(message ?? code)
    this.name = 'ImageError'
    this.status = status
    this.code = code
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'unknown'
}

export function asImageError(error: unknown): ImageError {
  if (error instanceof ImageError) return error
  return new ImageError(500, 'internal', errorMessage(error))
}
