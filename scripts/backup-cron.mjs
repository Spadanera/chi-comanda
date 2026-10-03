#!/usr/bin/env node
/**
 * Daily backup of an installation's database, run by the `backup` cron service of its Railway project (DEPLOY.md,
 * *Automatic daily backups*): mysqldump over the project's private network, validated, gzipped, encrypted with the
 * backup public key and uploaded to the bucket. Read-only on the database. Exits with an error (Railway marks the run
 * as failed) and alerts Sentry when anything goes wrong.
 *
 * Environment (set on the service, never in the repository):
 *   MYSQL_URL                      ${{MySQL.MYSQL_URL}} (private network)
 *   BACKUP_PUBLIC_KEY              PEM of the RSA public key (the private one stays offline)
 *   BACKUP_S3_ENDPOINT             e.g. https://<account id>.r2.cloudflarestorage.com
 *   BACKUP_S3_BUCKET, BACKUP_S3_ACCESS_KEY_ID, BACKUP_S3_SECRET_ACCESS_KEY, BACKUP_S3_REGION (default auto)
 *   BACKUP_PREFIX                  folder in the bucket, e.g. libra or libra-staging (default CLIENT_SLUG)
 *   SENTRY_DSN                     optional, for failure alerts
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { dumpToFile, validateDump } from './lib/backup.mjs'
import { encryptBackup } from './lib/encrypt.mjs'
import { s3Client } from './lib/s3.mjs'
import { sentryAlert } from './lib/alert.mjs'
import { timestamp } from './backup-client.mjs'

const REQUIRED = ['MYSQL_URL', 'BACKUP_PUBLIC_KEY', 'BACKUP_S3_ENDPOINT', 'BACKUP_S3_BUCKET', 'BACKUP_S3_ACCESS_KEY_ID', 'BACKUP_S3_SECRET_ACCESS_KEY']

/** Prefix of the objects: lowercase letters, digits and hyphens, as a slug. */
export function backupPrefix(env) {
    const prefix = env.BACKUP_PREFIX || env.CLIENT_SLUG
    if (!prefix || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(prefix)) throw new Error('BACKUP_PREFIX (or CLIENT_SLUG) must be set: lowercase letters, digits, hyphens')
    return prefix
}

/**
 * @param env  process.env-like
 * @param deps { dump(options), validate(file), s3, log, now?, tmpDir? }
 * @returns    { key, size, details }
 */
export async function runBackup(env, deps) {
    const missing = REQUIRED.filter(name => !env[name])
    if (missing.length) throw new Error(`Missing environment variables: ${missing.join(', ')}`)
    const prefix = backupPrefix(env)
    const dir = mkdtempSync(path.join(deps.tmpDir || os.tmpdir(), 'backup-'))
    try {
        const file = path.join(dir, 'dump.sql')
        deps.log(`→ dump of ${new URL(env.MYSQL_URL).hostname}`)
        await deps.dump({ url: env.MYSQL_URL, file, local: true })
        const details = deps.validate(file)
        deps.log(`✓ ${(details.size / 1024 / 1024).toFixed(1)} MB, ${details.tables} tables, ${details.inserts} INSERT statements, last migration ${details.lastMigration ?? 'none'}`)

        const encrypted = encryptBackup(readFileSync(file), env.BACKUP_PUBLIC_KEY.replace(/\\n/g, '\n'))
        const key = `${prefix}/${prefix}-${timestamp(deps.now)}-full.sql.gz.enc`
        await deps.s3.put(key, encrypted)
        // Read back: the run succeeds only when the bucket holds the whole file
        const stored = await deps.s3.size(key)
        if (stored !== encrypted.length) throw new Error(`Uploaded ${key} but the bucket reports ${stored} bytes instead of ${encrypted.length}`)
        deps.log(`✓ uploaded ${key} (${(encrypted.length / 1024 / 1024).toFixed(1)} MB encrypted)`)
        return { key, size: encrypted.length, details }
    } finally {
        rmSync(dir, { recursive: true, force: true })
    }
}

async function main() {
    const env = process.env
    try {
        await runBackup(env, {
            dump: dumpToFile,
            validate: validateDump,
            s3: s3Client({
                endpoint: env.BACKUP_S3_ENDPOINT, bucket: env.BACKUP_S3_BUCKET, region: env.BACKUP_S3_REGION || 'auto',
                accessKeyId: env.BACKUP_S3_ACCESS_KEY_ID, secretAccessKey: env.BACKUP_S3_SECRET_ACCESS_KEY,
            }),
            log: message => console.log(message),
        })
    } catch (error) {
        console.error(`✗ Backup failed: ${error.message}`)
        await sentryAlert(env.SENTRY_DSN, `Backup failed: ${error.message}`, {
            tags: { service: 'backup', client: env.BACKUP_PREFIX || env.CLIENT_SLUG || 'unknown' },
            environment: env.RAILWAY_ENVIRONMENT_NAME,
        })
        process.exit(1)
    }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    main()
}
