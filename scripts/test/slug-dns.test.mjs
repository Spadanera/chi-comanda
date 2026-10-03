import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { RESERVED_SLUGS, validateSlug } from '../lib/slug.mjs'
import { assertManagedName, cloudflareClient, planDnsRecords, railwayRequiredRecords } from '../lib/dns.mjs'

const zone = 'chicomanda.com'
const cname = { type: 'CNAME', name: 'libra.chicomanda.com', content: 'abc123.up.railway.app' }
const txt = { type: 'TXT', name: '_railway-verify.libra.chicomanda.com', content: 'railway-verify=tok' }

describe('slug', () => {
    it('accepts lowercase letters, digits and inner hyphens, 2-30 characters', () => {
        for (const slug of ['libra', 'al-mare', 'b2', 'a'.repeat(30)]) assert.equal(validateSlug(slug), slug)
    })

    it('refuses anything else', () => {
        for (const slug of ['a', 'a'.repeat(31), '-libra', 'libra-', 'Libra', 'li_bra', 'li.bra', 'lìbra', '', undefined]) {
            assert.throws(() => validateSlug(slug), /Invalid slug/, String(slug))
        }
    })

    it('refuses reserved names', () => {
        assert.deepEqual(RESERVED_SLUGS, ['www', 'mail', 'api', 'app', 'admin', 'staging', 'stage', 'status'])
        for (const slug of RESERVED_SLUGS) assert.throws(() => validateSlug(slug), /reserved/)
    })
})

describe('managed DNS names', () => {
    it('are the subdomain and the names below it', () => {
        assert.equal(assertManagedName('libra.chicomanda.com', 'libra', zone), 'libra.chicomanda.com')
        assert.equal(assertManagedName('_railway-verify.libra.chicomanda.com.', 'libra', zone), '_railway-verify.libra.chicomanda.com')
    })

    it('never include the apex, other subdomains or look-alikes', () => {
        for (const name of ['chicomanda.com', 'www.chicomanda.com', 'xlibra.chicomanda.com', 'libra.chicomanda.com.evil.com', 'other.chicomanda.com']) {
            assert.throws(() => assertManagedName(name, 'libra', zone), /Refusing to touch/, name)
        }
    })
})

describe('records required by Railway', () => {
    it('are read from the domain status, wherever the CLI nests them', () => {
        const output = {
            domain: {
                domain: 'libra.chicomanda.com',
                status: {
                    dnsRecords: [{ recordType: 'DNS_RECORD_TYPE_CNAME', fqdn: 'libra.chicomanda.com', hostlabel: 'libra', requiredValue: 'abc123.up.railway.app.', purpose: 'DNS_RECORD_PURPOSE_TRAFFIC_ROUTE' }],
                    verificationDnsHost: '_railway-verify.libra',
                    verificationToken: 'railway-verify=tok',
                },
            },
        }
        assert.deepEqual(railwayRequiredRecords(output, zone), [cname, txt])
    })
})

describe('DNS plan', () => {
    const plan = (existing, proxied) => planDnsRecords({ required: [cname, txt], existing, slug: 'libra', zone, proxied })

    it('creates the CNAME and the verification TXT, not proxied by default', () => {
        assert.deepEqual(plan([]).map(s => [s.action, s.record.type, s.record.proxied]), [['create', 'CNAME', false], ['create', 'TXT', false]])
    })

    it('with --proxied puts only the subdomain CNAME behind the proxy', () => {
        assert.deepEqual(plan([], true).map(s => [s.record.type, s.record.proxied]), [['CNAME', true], ['TXT', false]])
    })

    it('leaves identical records alone', () => {
        const existing = [{ id: '1', ...cname, content: 'ABC123.up.railway.app', proxied: false }, { id: '2', ...txt, content: '"railway-verify=tok"' }]
        assert.deepEqual(plan(existing).map(s => s.action), ['skip', 'skip'])
    })

    it('asks before changing a different CNAME (or its proxy setting)', () => {
        assert.equal(plan([{ id: '1', ...cname, content: 'old.up.railway.app', proxied: false }])[0].action, 'update')
        assert.equal(plan([{ id: '1', ...cname, proxied: true }])[0].action, 'update')
    })

    it('never modifies an existing TXT: adds the new one next to it', () => {
        const step = plan([{ id: '9', ...txt, content: 'railway-verify=old' }])[1]
        assert.equal(step.action, 'create')
    })

    it('stops when other records live at the subdomain (A, MX, TXT...)', () => {
        for (const type of ['A', 'MX', 'TXT']) {
            const step = plan([{ id: '7', type, name: 'libra.chicomanda.com', content: 'x' }])[0]
            assert.equal(step.action, 'conflict', type)
        }
    })

    it('refuses records outside the subdomain even if Railway asks for them', () => {
        assert.throws(() => planDnsRecords({ required: [{ type: 'TXT', name: 'chicomanda.com', content: 'x' }], existing: [], slug: 'libra', zone }), /Refusing/)
    })
})

describe('Cloudflare client', () => {
    it('creates records with automatic TTL and the requested proxy setting', async () => {
        const calls = []
        const fetchImpl = async (url, init) => {
            calls.push({ url, method: init.method, body: init.body && JSON.parse(init.body), auth: init.headers.Authorization })
            return { ok: true, status: 200, json: async () => ({ success: true, result: { id: 'new' } }) }
        }
        const cf = cloudflareClient({ token: 'tkn', zoneId: 'zone1', fetchImpl })
        await cf.create({ ...cname, proxied: false }, 'chi-comanda new-client libra')
        assert.deepEqual(calls[0], {
            url: 'https://api.cloudflare.com/client/v4/zones/zone1/dns_records', method: 'POST', auth: 'Bearer tkn',
            body: { type: 'CNAME', name: cname.name, content: cname.content, ttl: 1, proxied: false, comment: 'chi-comanda new-client libra' },
        })
    })

    it('reports API errors', async () => {
        const fetchImpl = async () => ({ ok: false, status: 403, json: async () => ({ success: false, errors: [{ message: 'Authentication error' }] }) })
        await assert.rejects(cloudflareClient({ token: 't', zoneId: 'z', fetchImpl }).list('libra.chicomanda.com'), /HTTP 403 Authentication error/)
    })
})
