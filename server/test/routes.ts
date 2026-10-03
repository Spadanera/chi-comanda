/** The routes of an Express router as `METHOD /path` (mount paths included), to check that tests cover them all. */
export function listRoutes(router: any, prefix = ''): string[] {
    const routes: string[] = []
    for (const layer of router.stack) {
        if (layer.route) {
            for (const method of Object.keys(layer.route.methods)) {
                routes.push(`${method.toUpperCase()} ${prefix}${layer.route.path}`)
            }
        } else if (layer.handle?.stack) {
            routes.push(...listRoutes(layer.handle, prefix + mountPath(layer)))
        }
    }
    return routes
}

/** Static mount path of a `router.use('/path', ...)` layer, from the regexp Express 4 builds for it. */
function mountPath(layer: any): string {
    if (layer.regexp.fast_slash) return ''
    return layer.regexp.source
        .replace('\\/?(?=\\/|$)', '')
        .replace(/^\^/, '')
        .replace(/\\\//g, '/')
}
