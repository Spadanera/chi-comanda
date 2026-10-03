/**
 * DNS records of a client's subdomain on Cloudflare.
 *
 * Safety rules: the only names that may be created or changed are `<slug>.<zone>` and names below it (Railway's
 * verification and certificate records, e.g. `_railway-verify.<slug>.<zone>`). The zone apex, MX records and existing
 * TXT records are never modified or deleted: a TXT is only ever added.
 */

const strip = value => String(value || '').trim().replace(/^"|"$/g, '').replace(/\.$/, '')
const sameName = (a, b) => strip(a).toLowerCase() === strip(b).toLowerCase()

/** Throws unless `name` belongs to the client's subdomain. */
export function assertManagedName(name, slug, zone) {
    const fqdn = strip(name).toLowerCase()
    const subdomain = `${slug}.${zone}`.toLowerCase()
    if (fqdn !== subdomain && !fqdn.endsWith(`.${subdomain}`)) {
        throw new Error(`Refusing to touch DNS record "${name}": only ${subdomain} and names below it are managed`)
    }
    return fqdn
}

const TYPES = { DNS_RECORD_TYPE_CNAME: 'CNAME', DNS_RECORD_TYPE_TXT: 'TXT', DNS_RECORD_TYPE_A: 'A' }

/** `host` may be relative to the zone (`_railway-verify.libra`) or absolute. */
function toFqdn(host, zone) {
    const name = strip(host).toLowerCase()
    return name === zone || name.endsWith(`.${zone}`) ? name : `${name}.${zone}`
}

/**
 * The records Railway asks for a custom domain, from `railway domain status --json` (or `railway domain <name>
 * --json`). The CLI output is searched for `dnsRecords` and the verification TXT wherever they are nested.
 */
export function railwayRequiredRecords(output, zone) {
    const records = []
    const visit = node => {
        if (!node || typeof node !== 'object') return
        if (Array.isArray(node.dnsRecords)) {
            for (const r of node.dnsRecords) {
                const type = TYPES[r.recordType] || r.recordType || r.type
                const name = r.fqdn || r.hostlabel || r.name
                const content = r.requiredValue || r.value || r.content
                if (type && name && content) records.push({ type, name: toFqdn(name, zone), content: strip(content) })
            }
        }
        if (node.verificationDnsHost && node.verificationToken) {
            records.push({ type: 'TXT', name: toFqdn(node.verificationDnsHost, zone), content: strip(node.verificationToken) })
        }
        Object.values(node).forEach(child => { if (typeof child === 'object') visit(child) })
    }
    visit(output)
    // The same record can appear twice (e.g. top level and under `status`)
    return records.filter((r, i) => records.findIndex(o => o.type === r.type && o.name === r.name && o.content === r.content) === i)
}

/**
 * What to do for each record Railway requires, given the records that already exist at those names.
 * Actions: `skip` (already there), `create`, `update` (a different CNAME: needs confirmation), `conflict` (stop).
 */
export function planDnsRecords({ required, existing, slug, zone, proxied = false }) {
    return required.map(record => {
        const name = assertManagedName(record.name, slug, zone)
        if (!['CNAME', 'TXT'].includes(record.type)) {
            return { action: 'conflict', record, reason: `Railway asks for a ${record.type} record, which this script does not manage` }
        }
        // Only the traffic CNAME of the subdomain itself goes through the proxy; verification records never do
        const wanted = { ...record, name, proxied: record.type === 'CNAME' && name === `${slug}.${zone}` ? proxied : false }
        const here = existing.filter(e => sameName(e.name, name))

        if (record.type === 'TXT') {
            const same = here.find(e => e.type === 'TXT' && strip(e.content) === wanted.content)
            // Never change an existing TXT: add the new one next to it
            return same ? { action: 'skip', record: wanted, current: same } : { action: 'create', record: wanted }
        }

        const others = here.filter(e => e.type !== 'CNAME')
        if (others.length) {
            return {
                action: 'conflict', record: wanted,
                reason: `${name} already has ${others.map(o => o.type).join(', ')} records: a CNAME can't coexist with them`,
            }
        }
        const current = here.find(e => e.type === 'CNAME')
        if (!current) return { action: 'create', record: wanted }
        if (sameName(current.content, wanted.content) && !!current.proxied === wanted.proxied) {
            return { action: 'skip', record: wanted, current }
        }
        return { action: 'update', record: wanted, current }
    })
}

/** Minimal Cloudflare DNS API client (https://developers.cloudflare.com/api/resources/dns/subresources/records/). */
export function cloudflareClient({ token, zoneId, fetchImpl = fetch }) {
    const base = `https://api.cloudflare.com/client/v4/zones/${zoneId}`
    async function call(method, path, body) {
        const response = await fetchImpl(`${base}${path}`, {
            method,
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined,
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok || data.success === false) {
            const messages = (data.errors || []).map(e => e.message).join('; ')
            throw new Error(`Cloudflare ${method} ${path}: HTTP ${response.status} ${messages}`)
        }
        return data.result
    }
    return {
        async zoneName() {
            return (await call('GET', '')).name
        },
        /** Records with exactly this name. */
        list(name) {
            return call('GET', `/dns_records?name=${encodeURIComponent(name)}&per_page=100`)
        },
        create(record, comment) {
            return call('POST', '/dns_records', { type: record.type, name: record.name, content: record.content, ttl: 1, proxied: record.proxied, comment })
        },
        update(id, record, comment) {
            return call('PATCH', `/dns_records/${id}`, { type: record.type, name: record.name, content: record.content, ttl: 1, proxied: record.proxied, comment })
        },
    }
}
