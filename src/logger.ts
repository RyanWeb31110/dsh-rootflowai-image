export interface Logger {
  info(message: string): void
  warn(message: string): void
}

/** Cordis exposes `ctx.logger` either as an object or as `logger(name)`. */
export function pluginLogger(ctx: { logger?: unknown }, name: string): Logger {
  const raw = ctx.logger
  const named = typeof raw === 'function'
    ? (raw as (channel: string) => unknown)(name)
    : raw
  const target = named && typeof named === 'object'
    ? named as { info?: (message: string) => void; warn?: (message: string) => void }
    : undefined
  return {
    info(message: string) {
      if (typeof target?.info === 'function') target.info(message)
      else console.info(`[${name}] ${message}`)
    },
    warn(message: string) {
      if (typeof target?.warn === 'function') target.warn(message)
      else console.warn(`[${name}] ${message}`)
    },
  }
}
