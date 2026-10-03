#!/usr/bin/env node
/**
 * Creates (or completes) the installation of a new client: Railway project with MySQL and the app on the production
 * branch, variables, <slug>.chicomanda.com with its DNS records on Cloudflare, first superuser.
 *
 *   node scripts/new-client.mjs <slug> --name "Venue name" --superuser-email someone@example.com [options]
 *
 * Idempotent: run it again after a failure and it continues; what already exists with the same value is left alone,
 * what exists with a different value is never overwritten without confirmation. See DEPLOY.md.
 */
import { randomBytes } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import { validateSlug } from './lib/slug.mjs'
import { cloudflareClient, planDnsRecords, railwayRequiredRecords } from './lib/dns.mjs'
import { railwayCli } from './lib/railway.mjs'
import { mysqlClient } from './lib/mysql.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export const DEFAULTS = {
    zone: 'chicomanda.com',
    repo: 'Spadanera/chi-comanda',
    branch: 'production',
    appService: 'app',
    mysqlService: 'MySQL',
    port: 8080,
    healthTimeoutMs: 15 * 60 * 1000,
    healthIntervalMs: 15 * 1000,
}

/** The functions FEATURES may list, read from the server so the two never diverge. */
export function knownFeatures() {
    const source = readFileSync(path.join(ROOT, 'server/src/features.ts'), 'utf8')
    const list = source.slice(source.indexOf('export const FEATURES'), source.indexOf('] as const'))
    return [...list.matchAll(/^\s*'([a-z-]+)',/gm)].map(m => m[1])
}

export class Aborted extends Error { }

/**
 * @param options { slug, name, superuserEmail, features?, proxied?, dryRun?, workspace? } plus DEFAULTS overrides
 * @param deps    { railway, cloudflare (null without credentials), mysql(url), fetchImpl, confirm(question), log,
 *                  generateVapidKeys, randomSecret, sleep }
 */
export async function newClient(options, deps) {
    const o = { ...DEFAULTS, ...options }
    const { railway, log } = deps
    const domain = `${o.slug}.${o.zone}`
    const projectName = `chi-comanda-${o.slug}`
    const baseUrl = `https://${domain}`
    const summary = { domain, project: projectName, invitation: null, manual: [] }

    // ── Checks, before touching anything ───────────────────────────────────
    validateSlug(o.slug)
    if (!o.name || !o.name.trim()) throw new Error('--name is required (the venue name, e.g. "Libra")')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(o.superuserEmail || '')) throw new Error('--superuser-email is required')
    if (o.features !== undefined) {
        const known = knownFeatures()
        const unknown = o.features.split(',').map(f => f.trim()).filter(f => f && !known.includes(f))
        if (unknown.length) throw new Error(`Unknown features: ${unknown.join(', ')}. Valid: ${known.join(', ')}`)
    }
    if (!deps.cloudflare && !o.dryRun) {
        throw new Error('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID must be set in the environment (never in the repo)')
    }
    await railway.whoami().catch(() => { throw new Error('The Railway CLI is not logged in: run `railway login`') })
    if (deps.cloudflare) {
        const zoneName = await deps.cloudflare.zoneName()
        if (zoneName !== o.zone) throw new Error(`CLOUDFLARE_ZONE_ID is the zone of ${zoneName}, not ${o.zone}`)
    }

    const tag = o.dryRun ? '[dry-run] would' : '→'
    /** Runs a change, or only describes it in dry-run. */
    const change = async (description, fn) => {
        log(`${tag} ${description}`)
        return o.dryRun ? undefined : fn()
    }
    const confirmOrAbort = async question => {
        if (o.dryRun) {
            log(`[dry-run] would ask: ${question}`)
            return
        }
        if (!(await deps.confirm(question))) throw new Aborted('Stopped: nothing was overwritten')
    }

    // ── Railway project ────────────────────────────────────────────────────
    let project = (await railway.projects()).find(p => p.name === projectName)
    if (!project) {
        await change(`create Railway project ${projectName}`, () => railway.createProject(projectName, o.workspace))
        if (o.dryRun) {
            log(`[dry-run] the project doesn't exist yet: everything below would be created from scratch`)
            planFromScratch(o, log)
            return summary
        }
        project = (await railway.projects()).find(p => p.name === projectName)
        if (!project) throw new Error(`Project ${projectName} not found after creating it`)
    } else {
        log(`✓ project ${projectName} exists (${project.id})`)
    }
    // Local only: links the temporary working directory, not the repository
    await railway.link(project.id)

    // ── Services ───────────────────────────────────────────────────────────
    let services = await railway.services()
    const find = name => services.find(s => s.name === name)
    if (!find(o.mysqlService)) {
        await change('add MySQL', () => railway.addMysql())
    } else log(`✓ service ${o.mysqlService} exists`)
    if (!find(o.appService)) {
        await change(`add service ${o.appService} from ${o.repo}, branch ${o.branch}`, () => railway.addApp(o.appService, o.repo, o.branch))
    } else log(`✓ service ${o.appService} exists`)
    if (!o.dryRun) services = await railway.services()

    let config = await railway.environmentConfig()
    const serviceConfig = name => config.services?.[find(name)?.id] || {}
    const source = serviceConfig(o.appService).source
    if (find(o.appService) && source && (source.repo !== o.repo || source.branch !== o.branch)) {
        await confirmOrAbort(`Service ${o.appService} deploys ${source.repo}@${source.branch}, not ${o.repo}@${o.branch}. Change it?`)
        await change(`connect ${o.appService} to ${o.repo}@${o.branch}`, () => railway.connectSource(o.appService, o.repo, o.branch))
    }

    // ── Variables ──────────────────────────────────────────────────────────
    const current = find(o.appService) ? await railway.variables(o.appService) : {}
    const wanted = {
        BASE_URL: baseUrl,
        CLIENT_NAME: o.name.trim(),
        CLIENT_SLUG: o.slug,
        PORT: String(o.port),
        MYSQL_HOST: `\${{${o.mysqlService}.MYSQLHOST}}`,
        MYSQL_PORT: `\${{${o.mysqlService}.MYSQLPORT}}`,
        MYSQL_USER: `\${{${o.mysqlService}.MYSQLUSER}}`,
        MYSQL_PASSWORD: `\${{${o.mysqlService}.MYSQLPASSWORD}}`,
        MYSQL_DATABASE: `\${{${o.mysqlService}.MYSQL_DATABASE}}`,
        ...(o.features !== undefined ? { FEATURES: o.features } : {}),
    }
    // Secrets are generated only when missing, never replaced
    if (!current.SECRET) wanted.SECRET = deps.randomSecret()
    if (!current.VAPID_PUBLIC_KEY && !current.VAPID_PRIVATE_KEY) {
        const keys = deps.generateVapidKeys()
        wanted.VAPID_PUBLIC_KEY = keys.publicKey
        wanted.VAPID_PRIVATE_KEY = keys.privateKey
    } else if (!current.VAPID_PUBLIC_KEY || !current.VAPID_PRIVATE_KEY) {
        throw new Error('Only one of VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY is set: fix it by hand, they are a pair')
    }
    const SECRET_KEYS = ['SECRET', 'VAPID_PRIVATE_KEY']
    const shown = (key, value) => SECRET_KEYS.includes(key) ? '<generated>' : value
    let variablesChanged = false
    for (const [key, value] of Object.entries(wanted)) {
        // References are resolved in the listing: compare those by name only once set
        const isReference = value.startsWith('${{')
        if (current[key] !== undefined && (current[key] === value || isReference)) continue
        if (current[key] !== undefined && current[key] !== value) {
            await confirmOrAbort(`${key} is "${current[key]}", should be "${value}". Overwrite?`)
        }
        await change(`set ${key}=${shown(key, value)}`, () => railway.setVariable(o.appService, key, value))
        variablesChanged = true
    }

    // ── MySQL serverless (App Sleeping) off: a sleeping database didn't wake up on staging ──
    if (!o.dryRun) config = await railway.environmentConfig()
    for (const name of [o.mysqlService, o.appService]) {
        if (serviceConfig(name).deploy?.sleepApplication !== false) {
            await change(`turn off App Sleeping on ${name}`, () => railway.setServiceConfig(name, 'deploy.sleepApplication', false))
        }
    }

    // ── Custom domain and DNS ──────────────────────────────────────────────
    const domains = find(o.appService) ? await railway.domains(o.appService) : []
    if (!domains.some(d => d.domain === domain)) {
        await change(`add custom domain ${domain} (port ${o.port})`, () => railway.addDomain(o.appService, domain, o.port))
    } else log(`✓ domain ${domain} exists`)
    const required = o.dryRun && !domains.some(d => d.domain === domain)
        ? [{ type: 'CNAME', name: domain, content: '<target assigned by Railway>' }]
        : railwayRequiredRecords(await railway.domainStatus(o.appService, domain), o.zone)
    if (!required.some(r => r.type === 'CNAME' && r.name === domain)) {
        throw new Error(`Railway did not report the CNAME for ${domain}: check \`railway domain status ${domain}\``)
    }

    if (!deps.cloudflare) {
        log('[dry-run] Cloudflare credentials not set: DNS records not checked. Railway asks for:')
        required.forEach(r => log(`    ${r.type} ${r.name} → ${r.content}`))
    } else {
        const existing = (await Promise.all([...new Set(required.map(r => r.name))].map(n => deps.cloudflare.list(n)))).flat()
        const comment = `chi-comanda new-client ${o.slug}`
        for (const step of planDnsRecords({ required, existing, slug: o.slug, zone: o.zone, proxied: !!o.proxied })) {
            const r = step.record
            const label = `${r.type} ${r.name} → ${r.content}${r.type === 'CNAME' ? ` (proxied=${r.proxied})` : ''}`
            if (step.action === 'skip') log(`✓ DNS ${label} exists`)
            else if (step.action === 'create') await change(`create DNS ${label}`, () => deps.cloudflare.create(r, comment))
            else if (step.action === 'conflict') throw new Error(`DNS conflict: ${step.reason}. Nothing was changed on Cloudflare for it`)
            else {
                // Only ever a CNAME of the client's subdomain (planDnsRecords), checked again right before the change
                if (step.current.type !== 'CNAME') throw new Error(`Refusing to modify ${step.current.type} record ${step.current.name}`)
                await confirmOrAbort(`DNS ${r.name} is CNAME ${step.current.content} (proxied=${!!step.current.proxied}), should be ${label}. Change it?`)
                await change(`update DNS ${label}`, () => deps.cloudflare.update(step.current.id, r, comment))
            }
        }
    }

    // ── Deploy and health ──────────────────────────────────────────────────
    if (variablesChanged) await change(`redeploy ${o.appService} with the new variables`, () => railway.redeploy(o.appService))
    if (o.dryRun) {
        log(`[dry-run] would wait for ${baseUrl}/api/health and invite ${o.superuserEmail} as superuser`)
        return finish(summary, o, log)
    }
    await waitForHealth(`${baseUrl}/api/health`, o, deps)

    // ── First superuser ────────────────────────────────────────────────────
    const mysqlUrl = (await railway.variables(o.mysqlService)).MYSQL_PUBLIC_URL
    if (!mysqlUrl) throw new Error(`${o.mysqlService} has no MYSQL_PUBLIC_URL: enable its TCP proxy, then run again`)
    const result = await deps.mysql(mysqlUrl).ensureSuperuser(o.superuserEmail)
    if (result.token) {
        summary.invitation = `${baseUrl}/invitation/${result.token}`
        log(`→ superuser ${o.superuserEmail} ${result.status}: set the password within 24 hours at\n    ${summary.invitation}`)
    } else log(`✓ superuser ${o.superuserEmail} is already active`)
    return finish(summary, o, log)
}

function planFromScratch(o, log) {
    const domain = `${o.slug}.${o.zone}`
    for (const step of [
        'add MySQL (App Sleeping off)',
        `add service ${o.appService} from ${o.repo}, branch ${o.branch} (App Sleeping off)`,
        `set BASE_URL=https://${domain}, CLIENT_NAME=${o.name}, CLIENT_SLUG=${o.slug}, PORT=${o.port}, MYSQL_* references${o.features !== undefined ? `, FEATURES=${o.features}` : ''}`,
        'generate SECRET and the VAPID key pair',
        `add custom domain ${domain} and create on Cloudflare the CNAME (proxied=${!!o.proxied}) and verification records Railway asks for`,
        `wait for https://${domain}/api/health and invite ${o.superuserEmail} as superuser`,
    ]) log(`[dry-run] would ${step}`)
    finish({ domain }, o, log)
}

function finish(summary, o, log) {
    summary.manual = [
        `Google Cloud console → OAuth client → add the redirect URI https://${summary.domain}/api/auth/google/callback`,
        'Railway → app variables: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET, MAIL_API_KEY / MAIL_API_SECRET / MAIL_FROM / MAIL_FROM_NAME (shared secrets are not copied by this script)',
        'Optional: SENTRY_DSN / SENTRY_CLIENT_DSN',
        'The superuser sets name, logo and colours in Amministrazione → Impostazioni, and the payment providers if `payments` is on',
        `First backup: scripts/backup-client ${o.slug}`,
    ]
    log('\nStill to do by hand:')
    summary.manual.forEach(step => log(`  - ${step}`))
    return summary
}

async function waitForHealth(url, o, { fetchImpl, sleep, log }) {
    log(`→ waiting for ${url} (up to ${Math.round(o.healthTimeoutMs / 60000)} min: build, deploy, DNS and certificate)`)
    const deadline = Date.now() + o.healthTimeoutMs
    let last = ''
    while (Date.now() < deadline) {
        try {
            const response = await fetchImpl(url)
            const body = await response.json().catch(() => ({}))
            if (response.ok && body.status === 'ok') {
                log(`✓ ${url}: version ${body.version}, migration ${body.migration}`)
                return
            }
            last = `HTTP ${response.status}`
        } catch (error) {
            last = error.cause?.code || error.message
        }
        await sleep(o.healthIntervalMs)
    }
    throw new Error(`${url} did not answer in time (last: ${last}). Check \`railway logs\` and the DNS records, then run again`)
}

// ── Command line ───────────────────────────────────────────────────────────

const USAGE = `Usage: node scripts/new-client.mjs <slug> --name "Venue" --superuser-email email [options]

  --name <name>              Venue name (CLIENT_NAME)
  --superuser-email <email>  First superuser: receives the invitation link (printed at the end)
  --features <list>          FEATURES, comma separated (omit for every function)
  --proxied                  Create the subdomain behind the Cloudflare proxy (needs SSL/TLS "Full")
  --workspace <id|name>      Railway workspace for a new project
  --dry-run                  Only read Railway and Cloudflare and print what would change

Environment: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID (required without --dry-run).`

async function main() {
    const { values, positionals } = parseArgs({
        allowPositionals: true,
        options: {
            name: { type: 'string' }, 'superuser-email': { type: 'string' }, features: { type: 'string' },
            proxied: { type: 'boolean' }, workspace: { type: 'string' }, 'dry-run': { type: 'boolean' }, help: { type: 'boolean' },
        },
    })
    if (values.help || positionals.length !== 1) {
        console.log(USAGE)
        process.exit(values.help ? 0 : 1)
    }
    const { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ZONE_ID: zoneId } = process.env
    const cwd = mkdtempSync(path.join(os.tmpdir(), 'new-client-'))
    const require = createRequire(path.join(ROOT, 'server/package.json'))
    const readline = createInterface({ input: process.stdin, output: process.stdout })
    try {
        await newClient({
            slug: positionals[0], name: values.name, superuserEmail: values['superuser-email'], features: values.features,
            proxied: values.proxied, workspace: values.workspace, dryRun: values['dry-run'],
        }, {
            railway: railwayCli({ cwd }),
            cloudflare: token && zoneId ? cloudflareClient({ token, zoneId }) : null,
            mysql: url => mysqlClient({ url }),
            fetchImpl: fetch,
            confirm: async question => {
                if (!process.stdin.isTTY) return false
                return /^(y|yes|s|si|sì)$/i.test((await readline.question(`${question} [y/N] `)).trim())
            },
            log: message => console.log(message),
            generateVapidKeys: () => require('web-push').generateVAPIDKeys(),
            randomSecret: () => randomBytes(48).toString('base64url'),
            sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
        })
    } finally {
        readline.close()
        rmSync(cwd, { recursive: true, force: true })
    }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    main().catch(error => {
        console.error(`\n✗ ${error.message}`)
        process.exit(error instanceof Aborted ? 2 : 1)
    })
}
