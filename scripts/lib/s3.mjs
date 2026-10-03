import { createHash, createHmac } from 'node:crypto'

/**
 * Minimal S3 client (AWS Signature Version 4), enough for backups on Cloudflare R2 or any S3-compatible storage:
 * put, head, get and list. No SDK, so the backup image needs nothing but Node.
 *
 * Credentials come from the caller (environment variables of the cron service, or of the shell for a restore);
 * they are never logged.
 */

const sha256 = data => createHash('sha256').update(data).digest('hex')
const hmac = (key, data) => createHmac('sha256', key).update(data).digest()
/** RFC 3986, as SigV4 wants it (encodeURIComponent leaves !'()* alone). */
const encode = value => encodeURIComponent(value).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)

/**
 * Signs a request: returns the headers to send (with `authorization`). `payloadHash` is the SHA-256 of the body
 * (hex), or `UNSIGNED-PAYLOAD`.
 */
export function signRequest({ method, url, headers = {}, payloadHash, accessKeyId, secretAccessKey, region = 'auto', service = 's3', now = new Date() }) {
    const u = new URL(url)
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
    const day = amzDate.slice(0, 8)
    const all = { ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v).trim()])),
        host: u.host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate }
    const names = Object.keys(all).sort()
    const query = [...u.searchParams.entries()].map(([k, v]) => [encode(k), encode(v)])
        .sort(([a, x], [b, y]) => (a < b ? -1 : a > b ? 1 : x < y ? -1 : x > y ? 1 : 0)).map(([k, v]) => `${k}=${v}`).join('&')
    const path = u.pathname.split('/').map(segment => encode(decodeURIComponent(segment))).join('/')
    const canonical = [method, path, query, names.map(n => `${n}:${all[n]}\n`).join(''), names.join(';'), payloadHash].join('\n')
    const scope = `${day}/${region}/${service}/aws4_request`
    const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonical)].join('\n')
    const key = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, day), region), service), 'aws4_request')
    const signature = createHmac('sha256', key).update(toSign).digest('hex')
    return {
        ...all,
        authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`,
    }
}

/**
 * @param options { endpoint (e.g. https://<account>.r2.cloudflarestorage.com), bucket, accessKeyId, secretAccessKey,
 *                  region? ('auto' for R2), fetchImpl? }
 */
export function s3Client({ endpoint, bucket, accessKeyId, secretAccessKey, region = 'auto', fetchImpl = fetch }) {
    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) throw new Error('S3 endpoint, bucket and credentials are required')
    const base = `${endpoint.replace(/\/$/, '')}/${encodeURIComponent(bucket)}`
    const objectUrl = key => `${base}/${key.split('/').map(encode).join('/')}`

    async function send(method, url, { body, headers = {}, payloadHash = sha256(body ?? '') } = {}) {
        const signed = signRequest({ method, url, headers, payloadHash, accessKeyId, secretAccessKey, region })
        const res = await fetchImpl(url, { method, headers: signed, body })
        if (!res.ok && !(method === 'HEAD' && res.status === 404)) {
            const text = await res.text().catch(() => '')
            throw new Error(`S3 ${method} ${new URL(url).pathname} failed: ${res.status} ${text.slice(0, 300)}`)
        }
        return res
    }

    return {
        /** Uploads a buffer (backups are a few MB: one request). */
        async put(key, body, contentType = 'application/octet-stream') {
            await send('PUT', objectUrl(key), { body, headers: { 'content-type': contentType, 'content-length': body.length } })
        },
        /** Size of the object, or null when it doesn't exist. */
        async size(key) {
            const res = await send('HEAD', objectUrl(key))
            return res.status === 404 ? null : Number(res.headers.get('content-length'))
        },
        async get(key) {
            return Buffer.from(await (await send('GET', objectUrl(key))).arrayBuffer())
        },
        /** Keys (with size and date) under a prefix, oldest first; at most 1000. */
        async list(prefix = '') {
            const url = `${base}?list-type=2&prefix=${encode(prefix)}`
            const xml = await (await send('GET', url)).text()
            return [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].map(([, c]) => ({
                key: c.match(/<Key>([^<]*)<\/Key>/)[1].replace(/&amp;/g, '&'),
                size: Number(c.match(/<Size>(\d+)<\/Size>/)?.[1] ?? 0),
                lastModified: c.match(/<LastModified>([^<]*)<\/LastModified>/)?.[1] ?? '',
            })).sort((a, b) => a.lastModified.localeCompare(b.lastModified))
        },
    }
}
