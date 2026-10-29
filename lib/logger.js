/** Cordis exposes `ctx.logger` either as an object or as `logger(name)`. */
export function pluginLogger(ctx, name) {
    const raw = ctx.logger;
    const named = typeof raw === 'function'
        ? raw(name)
        : raw;
    const target = named && typeof named === 'object'
        ? named
        : undefined;
    return {
        info(message) {
            if (typeof target?.info === 'function')
                target.info(message);
            else
                console.info(`[${name}] ${message}`);
        },
        warn(message) {
            if (typeof target?.warn === 'function')
                target.warn(message);
            else
                console.warn(`[${name}] ${message}`);
        },
    };
}
//# sourceMappingURL=logger.js.map