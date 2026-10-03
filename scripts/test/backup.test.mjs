import { after, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, writeSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MAIN_TABLES, dumpToFile, validateDump } from '../lib/backup.mjs'
import { backupClient, timestamp } from '../backup-client.mjs'

const tmp = mkdtempSync(path.join(os.tmpdir(), 'backup-test-'))
after(() => rmSync(tmp, { recursive: true, force: true }))

const URL_ = 'mysql://root:s3cr%40t@proxy.rlwy.net:4321/railway'
const dumpText = ({ trailer = true, tables = MAIN_TABLES, data = true } = {}) => [
    '-- MySQL dump 10.13',
    ...tables.map(t => `CREATE TABLE \`${t}\` (\n  \`id\` int\n);`),
    ...(data ? ["INSERT INTO `schema_migrations` VALUES (1,'001_baseline.sql',0,'2026-10-03'),(4,'004_settings.sql',1,'2026-10-03');", 'INSERT INTO `users` VALUES (1);'] : []),
    trailer ? '-- Dump completed on 2026-10-03  4:06:36' : '',
].join('\n')

function fakeSpawn(text, code = 0) {
    const calls = []
    const spawnImpl = (command, args, options) => {
        calls.push({ command, args, options })
        const child = new EventEmitter()
        child.stderr = new EventEmitter()
        setImmediate(() => {
            writeSync(options.stdio[1], text)
            child.stderr.emit('data', 'mysqldump: [Warning] Using a password on the command line interface can be insecure.\n')
            child.emit('close', code)
        })
        return child
    }
    return { spawnImpl, calls }
}

describe('dump', () => {
    it('runs mysqldump in docker with a consistent snapshot, the password only in the environment', async () => {
        const file = path.join(tmp, 'a.sql')
        const { spawnImpl, calls } = fakeSpawn(dumpText())
        await dumpToFile({ url: URL_, file, spawnImpl })

        const [{ command, args, options }] = calls
        assert.equal(command, 'docker')
        assert.deepEqual(args.slice(0, 6), ['run', '--rm', '-e', 'MYSQL_PWD', 'mysql:9', 'mysqldump'])
        for (const flag of ['--single-transaction', '--routines', '--triggers', '--set-gtid-purged=OFF']) assert.ok(args.includes(flag), flag)
        assert.ok(!args.includes('--no-data'))
        assert.equal(args.at(-1), 'railway')
        assert.equal(options.env.MYSQL_PWD, 's3cr@t')
        assert.ok(!args.join(' ').includes('s3cr'))
        assert.equal(statSync(file).mode & 0o777, 0o600)
        assert.equal(readFileSync(file, 'utf8'), dumpText())
    })

    it('adds --no-data for the structure dump and fails on a non-zero exit', async () => {
        const { spawnImpl, calls } = fakeSpawn('', 2)
        await assert.rejects(dumpToFile({ url: URL_, file: path.join(tmp, 'b.sql'), schemaOnly: true, spawnImpl }), /exited with 2/)
        assert.ok(calls[0].args.includes('--no-data'))
    })
})

describe('validation', () => {
    const write = (name, text) => { const file = path.join(tmp, name); writeFileSync(file, text); return file }

    it('accepts a complete dump and reports the last migration', () => {
        assert.deepEqual(validateDump(write('ok.sql', dumpText())), { size: dumpText().length, tables: MAIN_TABLES.length, inserts: 2, lastMigration: '004_settings.sql' })
    })

    it('refuses empty, truncated or incomplete dumps', () => {
        assert.throws(() => validateDump(write('empty.sql', '')), /empty/)
        assert.throws(() => validateDump(write('cut.sql', dumpText({ trailer: false }))), /incomplete/)
        assert.throws(() => validateDump(write('few.sql', dumpText({ tables: ['users'] }))), /lacks the tables roles/)
    })
})

describe('backup-client', () => {
    const railway = (projects = [{ id: 'p9', name: 'chi-comanda-libra' }]) => {
        const state = { linked: null }
        return {
            state,
            projects: async () => projects,
            link: async (id, environment) => { state.linked = [id, environment] },
            variables: async service => (service === 'MySQL' ? { MYSQL_PUBLIC_URL: URL_ } : {}),
        }
    }
    const deps = rw => {
        const dumps = []
        return {
            dumps,
            railway: rw,
            dump: async options => { dumps.push(options); writeFileSync(options.file, dumpText({ data: !options.schemaOnly })) },
            validate: validateDump,
            log: () => undefined,
        }
    }
    const now = new Date(2026, 9, 3, 5, 30)

    it('saves a full and a structure dump of the client project, named by slug and time', async () => {
        const rw = railway()
        const d = deps(rw)
        const result = await backupClient({ slug: 'libra', out: tmp, now }, d)
        assert.deepEqual(rw.state.linked, ['p9', 'production'])
        assert.deepEqual(d.dumps.map(x => [path.basename(x.file), x.schemaOnly, x.url]), [
            ['libra-2026-10-03-0530-full.sql', false, URL_],
            ['libra-2026-10-03-0530-schema.sql', true, URL_],
        ])
        assert.equal(result.full.lastMigration, '004_settings.sql')
    })

    it('works for installations in other projects and environments (Libra today, staging)', async () => {
        const rw = railway([{ id: 'p1', name: 'chi-comanda' }])
        const d = deps(rw)
        await backupClient({ slug: 'libra', project: 'chi-comanda', environment: 'staging', out: tmp, now }, d)
        assert.deepEqual(rw.state.linked, ['p1', 'staging'])
        assert.equal(path.basename(d.dumps[0].file), 'libra-staging-2026-10-03-0530-full.sql')
    })

    it('refuses to write inside the repository, and unknown projects', async () => {
        const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
        await assert.rejects(backupClient({ slug: 'libra', out: path.join(repo, 'backups') }, deps(railway())), /inside the repository/)
        await assert.rejects(backupClient({ slug: 'mare', out: tmp }, deps(railway())), /"chi-comanda-mare" not found/)
    })

    it('stamps the time to the minute', () => {
        assert.equal(timestamp(new Date(2026, 0, 5, 9, 7)), '2026-01-05-0907')
    })
})
