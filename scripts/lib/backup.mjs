import { spawn } from 'node:child_process'
import { chmodSync, closeSync, openSync, readFileSync, statSync } from 'node:fs'

/** Tables a dump of a working installation must contain. */
export const MAIN_TABLES = ['users', 'roles', 'events', 'orders', 'items', 'items_history', 'menu', 'master_items', 'schema_migrations']

/**
 * Runs `docker run mysql:<major> mysqldump ...` writing stdout straight to `file` (created with mode 600).
 * The password goes in MYSQL_PWD, inherited by the container, never on the command line.
 */
export function dumpToFile({ url, file, schemaOnly = false, image = 'mysql:9', spawnImpl = spawn }) {
    const { hostname, port, username, password, pathname } = new URL(url)
    const args = [
        'run', '--rm', '-e', 'MYSQL_PWD', image, 'mysqldump',
        '-h', hostname, '-P', port || '3306', '-u', decodeURIComponent(username),
        '--single-transaction', '--routines', '--triggers',
        // Restorable on any server (staging, a local copy) without GTID conflicts
        '--set-gtid-purged=OFF',
        ...(schemaOnly ? ['--no-data'] : []),
        decodeURIComponent(pathname.slice(1)),
    ]
    return new Promise((resolve, reject) => {
        const fd = openSync(file, 'w', 0o600)
        let stderr = ''
        const child = spawnImpl('docker', args, {
            env: { ...process.env, MYSQL_PWD: decodeURIComponent(password) },
            stdio: ['ignore', fd, 'pipe'],
        })
        child.stderr?.on('data', chunk => { stderr += chunk })
        child.on('error', error => { closeSync(fd); reject(error) })
        child.on('close', code => {
            closeSync(fd)
            chmodSync(file, 0o600)
            // mysqldump warns on stderr even on success: only the exit code counts
            code === 0 ? resolve({ args }) : reject(new Error(`mysqldump exited with ${code}: ${stderr.trim().split('\n').pop()}`))
        })
    })
}

/** Checks a dump file: not empty, complete ("Dump completed" trailer), with the main tables. Returns its details. */
export function validateDump(file, { schemaOnly = false } = {}) {
    const size = statSync(file).size
    if (size === 0) throw new Error(`${file} is empty`)
    const text = readFileSync(file, 'utf8')
    const tail = text.slice(-500)
    if (!/-- Dump completed on /.test(tail)) throw new Error(`${file} is incomplete: no "Dump completed" line at the end`)
    const tables = [...text.matchAll(/^CREATE TABLE `([^`]+)`/gm)].map(m => m[1])
    const missing = MAIN_TABLES.filter(t => !tables.includes(t))
    if (missing.length) throw new Error(`${file} lacks the tables ${missing.join(', ')}`)
    const inserts = schemaOnly ? 0 : (text.match(/^INSERT INTO `/gm) || []).length
    const migration = [...text.matchAll(/INSERT INTO `schema_migrations` VALUES (.+);/g)].pop()?.[1].match(/'(\d{3}_[\w-]+\.sql)'/g)?.pop()
    return { size, tables: tables.length, inserts, lastMigration: migration?.replace(/'/g, '') ?? null }
}
