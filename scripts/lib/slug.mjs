/** Subdomains that are not clients: product, infrastructure and Railway environments. */
export const RESERVED_SLUGS = ['www', 'mail', 'api', 'app', 'admin', 'staging', 'stage', 'status']

/** Lowercase letters, digits and hyphens, 2-30 characters, no leading or trailing hyphen. */
const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])$/

/** Throws with a clear message when `slug` can't be a client's subdomain. */
export function validateSlug(slug) {
    if (typeof slug !== 'string' || !SLUG.test(slug)) {
        throw new Error(`Invalid slug "${slug}": use 2-30 lowercase letters, digits or hyphens, not starting or ending with a hyphen`)
    }
    if (RESERVED_SLUGS.includes(slug)) {
        throw new Error(`Slug "${slug}" is reserved (${RESERVED_SLUGS.join(', ')})`)
    }
    return slug
}
