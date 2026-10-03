#!/usr/bin/env node
/**
 * Lists, downloads and decrypts the automatic backups (DEPLOY.md, *Automatic daily backups*). Never touches a
 * database: it produces a plain dump in ~/backups/chi-comanda/, validated, to restore with the procedure in DEPLOY.md.
 *
 *   node scripts/restore-backup.mjs list [prefix]
 *   node scripts/restore-backup.mjs fetch <object key | prefix (the latest)> --key <private.pem>
 *   node scripts/restore-backup.mjs decrypt <file.sql.gz.enc> --key <private.pem>
 *
 * The bucket credentials come from the shell (BACKUP_S3_ENDPOINT, BACKUP_S3_BUCKET, BACKUP_S3_ACCESS_KEY_ID,
 * BACKUP_S3_SECRET_ACCESS_KEY); a passphrase of the private key from BACKUP_KEY_PASSPHRASE.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import { decryptBackup } from './lib/encrypt.mjs'
import { s3Client } from './lib/s3.mjs'
import { validateDump } from './lib/backup.mjs'
import { DEFAULT_OUT } from './backup-client.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** The object to fetch: the key itself, or the latest backup under a prefix. */
export async function resolveKey(s3, keyOrPrefix) {
    if (keyOrPrefix.endsWith('.enc')) return keyOrPrefix
    const objects = (await s3.list(`${keyOrPrefix.replace(/\/$/, '')}/`)).filter(o => o.key.endsWith('.enc'))
    if (!objects.length) throw new Error(`No backup under ${keyOrPrefix}/`)
    return objects[objects.length - 1].key
}

/** Decrypts to `<out>/<name>.sql` (mode 600, outside the repository) and validates the dump. */
export function writeDecrypted(encrypted, name, { privateKey, passphrase, out = DEFAULT_OUT }) {
    const dir = path.resolve(out)
    if (dir === ROOT || dir.startsWith(ROOT + path.sep)) throw new Error(`Refusing to write backups inside the repository (${dir})`)
    mkdirSync(dir, { recursive: true, mode: 0o700 })
    const file = path.join(dir, path.basename(name).replace(/\.gz\.enc$/, '').replace(/\.enc$/, ''))
    writeFileSync(file, decryptBackup(encrypted, privateKey, passphrase), { mode: 0o600 })
    return { file, ...validateDump(file) }
}

function bucketFromEnv(env) {
    return s3Client({
        endpoint: env.BACKUP_S3_ENDPOINT, bucket: env.BACKUP_S3_BUCKET, region: env.BACKUP_S3_REGION || 'auto',
        accessKeyId: env.BACKUP_S3_ACCESS_KEY_ID, secretAccessKey: env.BACKUP_S3_SECRET_ACCESS_KEY,
    })
}

async function main() {
    const { values, positionals } = parseArgs({
        allowPositionals: true,
        options: { key: { type: 'string' }, out: { type: 'string' }, help: { type: 'boolean' } },
    })
    const [command, target] = positionals
    if (values.help || !['list', 'fetch', 'decrypt'].includes(command) || (command !== 'list' && !target)) {
        console.log('Usage:\n  node scripts/restore-backup.mjs list [prefix]\n' +
            '  node scripts/restore-backup.mjs fetch <object key | prefix> --key <private.pem>\n' +
            '  node scripts/restore-backup.mjs decrypt <file.sql.gz.enc> --key <private.pem>')
        process.exit(values.help ? 0 : 1)
    }
    if (command === 'list') {
        for (const o of await bucketFromEnv(process.env).list(target ? `${target.replace(/\/$/, '')}/` : '')) {
            console.log(`${o.lastModified}  ${(o.size / 1024 / 1024).toFixed(1).padStart(7)} MB  ${o.key}`)
        }
        return
    }
    if (!values.key) throw new Error('--key <private.pem> is required')
    const options = { privateKey: readFileSync(values.key), passphrase: process.env.BACKUP_KEY_PASSPHRASE, out: values.out }
    let encrypted, name
    if (command === 'fetch') {
        const s3 = bucketFromEnv(process.env)
        name = await resolveKey(s3, target)
        console.log(`→ downloading ${name}`)
        encrypted = await s3.get(name)
    } else {
        name = target
        encrypted = readFileSync(target)
    }
    const result = writeDecrypted(encrypted, name, options)
    console.log(`✓ ${result.file}: ${(result.size / 1024 / 1024).toFixed(1)} MB, ${result.tables} tables, last migration ${result.lastMigration ?? 'none'}`)
    console.log('Restore it with the procedure in DEPLOY.md (*Restoring*).')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    main().catch(error => {
        console.error(`\n✗ ${error.message}`)
        process.exit(1)
    })
}
