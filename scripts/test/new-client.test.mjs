import { beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Aborted, knownFeatures, newClient } from '../new-client.mjs'

/** In-memory Railway: records every change in `writes`. */
function fakeRailway(state) {
    const write = (name, ...args) => { state.writes.push([name, ...args]) }
    const appId = () => state.services.find(s => s.name === 'app')?.id
    return {
        whoami: async () => 'me',
        projects: async () => state.projects,
        createProject: async name => { write('createProject', name); state.projects.push({ id: 'p1', name }) },
        link: async id => { state.linked = id },
        services: async () => state.services,
        addMysql: async () => {
            write('addMysql')
            state.services.push({ id: 'db', name: 'MySQL' })
            state.config.services.db = { deploy: { sleepApplication: true } }
            state.variables.MySQL = { MYSQL_PUBLIC_URL: 'mysql://root:pw@proxy.rlwy.net:4321/railway' }
        },
        addApp: async (name, repo, branch) => {
            write('addApp', name, repo, branch)
            state.services.push({ id: 'svc', name })
            state.config.services.svc = { source: { repo, branch }, deploy: { sleepApplication: true } }
            state.variables.app = {}
        },
        connectSource: async (...args) => write('connectSource', ...args),
        environmentConfig: async () => structuredClone(state.config),
        variables: async service => ({ ...(state.variables[service] || {}) }),
        setVariable: async (service, key, value) => { write('setVariable', service, key); state.variables[service][key] = value },
        environmentId: async name => { assert.equal(name, 'production'); return 'env-prod' },
        sleepEnabled: async (serviceId, environmentId) => {
            assert.equal(environmentId, 'env-prod')
            return state.config.services[serviceId].deploy.sleepApplication !== false
        },
        disableSleep: async (serviceId, environmentId) => {
            write('disableSleep', serviceId, environmentId)
            state.config.services[serviceId].deploy.sleepApplication = false
        },
        redeploy: async service => write('redeploy', service),
        domains: async () => state.domains,
        addDomain: async (service, domain, port) => { write('addDomain', service, domain, port); state.domains.push({ domain, type: 'custom' }) },
        domainStatus: async (_service, domain) => ({
            domain: { domain, status: {
                dnsRecords: [{ recordType: 'DNS_RECORD_TYPE_CNAME', fqdn: domain, requiredValue: 'xyz.up.railway.app' }],
                verificationDnsHost: `_railway-verify.${domain.split('.')[0]}`, verificationToken: 'railway-verify=tok',
            } },
        }),
        _appId: appId,
    }
}

function fakeCloudflare(state) {
    return {
        zoneName: async () => state.zone,
        list: async name => state.dns.filter(r => r.name === name),
        create: async record => { state.writes.push(['dnsCreate', record.type, record.name, record.proxied]); state.dns.push({ id: `r${state.dns.length}`, ...record }) },
        update: async (id, record) => { state.writes.push(['dnsUpdate', id, record.content]); Object.assign(state.dns.find(r => r.id === id), record) },
    }
}

let state
let logs
let confirmations

function deps({ cloudflare = true, healthAfter = 1, superuser = 'invited' } = {}) {
    let healthCalls = 0
    return {
        railway: fakeRailway(state),
        cloudflare: cloudflare ? fakeCloudflare(state) : null,
        mysql: url => ({
            ensureSuperuser: async email => {
                state.writes.push(['superuser', email, url])
                return superuser === 'active' ? { status: 'active' } : { status: superuser, token: 'tok-123' }
            },
        }),
        fetchImpl: async url => {
            state.healthUrl = url
            healthCalls++
            return healthCalls > healthAfter
                ? { ok: true, status: 200, json: async () => ({ status: 'ok', version: '1.20.0', migration: '004_settings.sql' }) }
                : { ok: false, status: 503, json: async () => ({}) }
        },
        confirm: async question => { confirmations.push(question); return state.answer ?? false },
        log: message => logs.push(message),
        generateVapidKeys: () => ({ publicKey: 'vapid-pub', privateKey: 'vapid-priv' }),
        randomSecret: () => 'secret-xyz',
        sleep: async () => undefined,
    }
}

const options = (extra = {}) => ({ slug: 'libra', name: 'Libra', superuserEmail: 'boss@libra.it', ...extra })

beforeEach(() => {
    state = { projects: [], services: [], config: { services: {} }, variables: {}, domains: [], dns: [], writes: [], zone: 'chicomanda.com' }
    logs = []
    confirmations = []
})

describe('new-client', () => {
    it('creates the whole installation from scratch', async () => {
        const summary = await newClient(options({ features: 'push,payments' }), deps())

        const names = state.writes.map(w => w[0])
        assert.deepEqual(names.slice(0, 3), ['createProject', 'addMysql', 'addApp'])
        assert.deepEqual(state.writes.find(w => w[0] === 'addApp'), ['addApp', 'app', 'Spadanera/chi-comanda', 'production'])
        assert.equal(state.linked, 'p1')
        assert.deepEqual(state.variables.app, {
            BASE_URL: 'https://libra.chicomanda.com', CLIENT_NAME: 'Libra', CLIENT_SLUG: 'libra', PORT: '8080',
            MYSQL_HOST: '${{MySQL.MYSQLHOST}}', MYSQL_PORT: '${{MySQL.MYSQLPORT}}', MYSQL_USER: '${{MySQL.MYSQLUSER}}',
            MYSQL_PASSWORD: '${{MySQL.MYSQLPASSWORD}}', MYSQL_DATABASE: '${{MySQL.MYSQL_DATABASE}}',
            FEATURES: 'push,payments', SECRET: 'secret-xyz', VAPID_PUBLIC_KEY: 'vapid-pub', VAPID_PRIVATE_KEY: 'vapid-priv',
        })
        assert.equal(state.config.services.db.deploy.sleepApplication, false)
        assert.equal(state.config.services.svc.deploy.sleepApplication, false)
        assert.deepEqual(state.writes.find(w => w[0] === 'addDomain'), ['addDomain', 'app', 'libra.chicomanda.com', 8080])
        assert.deepEqual(state.writes.filter(w => w[0] === 'dnsCreate'), [
            ['dnsCreate', 'CNAME', 'libra.chicomanda.com', false],
            ['dnsCreate', 'TXT', '_railway-verify.libra.chicomanda.com', false],
        ])
        assert.ok(names.indexOf('redeploy') > names.indexOf('dnsCreate'))
        assert.equal(state.healthUrl, 'https://libra.chicomanda.com/api/health')
        assert.deepEqual(state.writes.at(-1), ['superuser', 'boss@libra.it', 'mysql://root:pw@proxy.rlwy.net:4321/railway'])
        assert.equal(summary.invitation, 'https://libra.chicomanda.com/invitation/tok-123')
        assert.ok(summary.manual.some(s => s.includes('https://libra.chicomanda.com/api/auth/google/callback')))
        // Secrets are never printed
        assert.ok(!logs.join('\n').includes('secret-xyz') && !logs.join('\n').includes('vapid-priv'))
    })

    it('changes nothing when run again', async () => {
        await newClient(options(), deps())
        state.writes = []
        await newClient(options(), deps({ superuser: 'active' }))
        assert.deepEqual(state.writes.filter(w => w[0] !== 'superuser'), [])
        assert.deepEqual(confirmations, [])
    })

    it('with --proxied creates the subdomain behind the Cloudflare proxy', async () => {
        await newClient(options({ proxied: true }), deps())
        assert.deepEqual(state.writes.filter(w => w[0] === 'dnsCreate').map(w => w[3]), [true, false])
    })

    it('in dry-run only reads, on a new project and on an existing one', async () => {
        await newClient(options({ dryRun: true }), deps({ cloudflare: false }))
        assert.deepEqual(state.writes, [])
        assert.ok(logs.some(l => l.startsWith('[dry-run] would create Railway project chi-comanda-libra')))

        await newClient(options(), deps())
        state.variables.app.CLIENT_NAME = 'Old name'
        state.dns.find(r => r.type === 'CNAME').content = 'old.up.railway.app'
        state.writes = []
        logs = []
        await newClient(options({ dryRun: true }), deps())
        assert.deepEqual(state.writes, [])
        assert.deepEqual(confirmations, [])
        assert.ok(logs.some(l => l.includes('would ask: CLIENT_NAME is "Old name"')))
        assert.ok(logs.some(l => l.includes('would ask: DNS libra.chicomanda.com is CNAME old.up.railway.app')))
    })

    it('never overwrites a different value without confirmation', async () => {
        await newClient(options(), deps())
        state.variables.app.CLIENT_NAME = 'Old name'
        state.writes = []

        await assert.rejects(newClient(options(), deps()), Aborted)
        assert.equal(state.variables.app.CLIENT_NAME, 'Old name')
        assert.deepEqual(state.writes, [])

        state.answer = true
        await newClient(options(), deps())
        assert.equal(state.variables.app.CLIENT_NAME, 'Libra')
    })

    it('never replaces existing secrets', async () => {
        await newClient(options(), deps())
        state.variables.app.SECRET = 'kept'
        state.writes = []
        await newClient(options(), deps())
        assert.equal(state.variables.app.SECRET, 'kept')
        assert.deepEqual(state.writes.filter(w => w[0] === 'setVariable'), [])
    })

    it('asks before pointing the subdomain somewhere else, and stops on other records there', async () => {
        await newClient(options(), deps())
        state.dns.find(r => r.type === 'CNAME').content = 'old.up.railway.app'
        state.writes = []
        await assert.rejects(newClient(options(), deps()), Aborted)
        assert.deepEqual(state.writes.filter(w => w[0].startsWith('dns')), [])

        state.dns = state.dns.filter(r => r.type !== 'CNAME')
        state.dns.push({ id: 'mx', type: 'MX', name: 'libra.chicomanda.com', content: 'mail.example.com' })
        await assert.rejects(newClient(options(), deps()), /DNS conflict/)
        assert.deepEqual(state.writes.filter(w => w[0].startsWith('dns')), [])
    })

    it('checks slug, credentials and zone before touching anything', async () => {
        await assert.rejects(newClient(options({ slug: 'www' }), deps()), /reserved/)
        await assert.rejects(newClient(options({ slug: 'Libra' }), deps()), /Invalid slug/)
        await assert.rejects(newClient(options(), deps({ cloudflare: false })), /CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID/)
        state.zone = 'other.com'
        await assert.rejects(newClient(options(), deps()), /zone of other.com/)
        await assert.rejects(newClient(options({ features: 'push,paymnets' }), deps()), /Unknown features: paymnets/)
        assert.deepEqual(state.writes, [])
    })

    it('fails clearly when the app does not come up', async () => {
        await assert.rejects(newClient(options({ healthTimeoutMs: 0 }), deps({ healthAfter: Infinity })), /did not answer in time/)
    })
})

describe('features', () => {
    it('are the same list as the server', () => {
        const server = readFileSync(new URL('../../server/src/features.ts', import.meta.url), 'utf8')
        assert.deepEqual(knownFeatures(), ['payments', 'push', 'google-login', 'broadcast', 'minimum-consumption', 'premium'])
        knownFeatures().forEach(f => assert.ok(server.includes(`'${f}'`)))
    })
})
