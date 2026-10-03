#!/usr/bin/env node
/**
 * Backup of a client's database: a full dump and a structure-only dump, both validated, saved outside the repository.
 *
 *   node scripts/backup-client.mjs <slug> [--project <name>] [--environment production] [--out ~/backups/chi-comanda]
 *
 * Read-only on the client's database (mysqldump --single-transaction). See DEPLOY.md for restoring.
 */
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import { validateSlug } from './lib/slug.mjs'
import { railwayCli } from './lib/railway.mjs'
import { dumpToFile, validateDump } from './lib/backup.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const DEFAULT_OUT = path.join(os.homedir(), 'backups', 'chi-comanda')

/** `2026-10-03-0530`: several backups a day don't overwrite each other. */
export function timestamp(date = new Date()) {
    const pad = n => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`
}

/**
 * @param options { slug, project?, environment?, out?, mysqlService?, now? }
 * @param deps    { railway, dump(options), validate(file, options), log }
 */
export async function backupClient(options, deps) {
    const slug = validateSlug(options.slug)
    const project = options.project || `chi-comanda-${slug}`
    const environment = options.environment || 'production'
    const out = path.resolve(options.out || DEFAULT_OUT)
    const { railway, log } = deps

    // Backups contain personal data: never inside the repository, where they could be committed
    if (out === ROOT || out.startsWith(ROOT + path.sep)) throw new Error(`Refusing to write backups inside the repository (${out})`)

    const found = (await railway.projects()).find(p => p.name === project)
    if (!found) throw new Error(`Railway project "${project}" not found (use --project for installations with another name)`)
    await railway.link(found.id, environment)
    const url = (await railway.variables(options.mysqlService || 'MySQL')).MYSQL_PUBLIC_URL
    if (!url) throw new Error('The MySQL service has no MYSQL_PUBLIC_URL (TCP proxy off?)')

    mkdirSync(out, { recursive: true, mode: 0o700 })
    const label = environment === 'production' ? slug : `${slug}-${environment}`
    const base = path.join(out, `${label}-${timestamp(options.now)}`)
    const result = {}
    for (const [kind, schemaOnly] of [['full', false], ['schema', true]]) {
        const file = `${base}-${kind}.sql`
        log(`→ ${kind} dump of ${project}/${environment} to ${file}`)
        await deps.dump({ url, file, schemaOnly })
        const details = deps.validate(file, { schemaOnly })
        log(`✓ ${(details.size / 1024 / 1024).toFixed(1)} MB, ${details.tables} tables` +
            (schemaOnly ? '' : `, ${details.inserts} INSERT statements, last migration ${details.lastMigration ?? 'none'}`))
        result[kind] = { file, ...details }
    }
    return result
}

async function main() {
    const { values, positionals } = parseArgs({
        allowPositionals: true,
        options: { project: { type: 'string' }, environment: { type: 'string' }, out: { type: 'string' }, help: { type: 'boolean' } },
    })
    if (values.help || positionals.length !== 1) {
        console.log('Usage: node scripts/backup-client.mjs <slug> [--project <name>] [--environment production] [--out <dir>]\n\n' +
            'Libra (before the move to its own project): node scripts/backup-client.mjs libra --project chi-comanda')
        process.exit(values.help ? 0 : 1)
    }
    const cwd = mkdtempSync(path.join(os.tmpdir(), 'backup-client-'))
    try {
        await backupClient({ slug: positionals[0], project: values.project, environment: values.environment, out: values.out }, {
            railway: railwayCli({ cwd }),
            dump: dumpToFile,
            validate: validateDump,
            log: message => console.log(message),
        })
    } finally {
        rmSync(cwd, { recursive: true, force: true })
    }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    main().catch(error => {
        console.error(`\n✗ ${error.message}`)
        process.exit(1)
    })
}
