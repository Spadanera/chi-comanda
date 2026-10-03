import { after, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { createServer } from 'node:http'
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { signRequest, s3Client } from '../lib/s3.mjs'
import { decryptBackup, encryptBackup } from '../lib/encrypt.mjs'
import { sentryAlert } from '../lib/alert.mjs'
import { runBackup, backupPrefix } from '../backup-cron.mjs'
import { resolveKey, writeDecrypted } from '../restore-backup.mjs'

const tmp = mkdtempSync(path.join(os.tmpdir(), 'backup-cron-test-'))
after(() => rmSync(tmp, { recursive: true, force: true }))

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})
const other = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } })

const DUMP = '-- MySQL dump\nCREATE TABLE `users` (id int);\nINSERT INTO `users` VALUES (1);\n-- Dump completed on 2026-10-04  3:30:00\n'

describe('S3 signature', () => {
    it('matches the example of the AWS documentation (GET object with a range)', () => {
        const headers = signRequest({
            method: 'GET', url: 'https://examplebucket.s3.amazonaws.com/test.txt', headers: { range: 'bytes=0-9' },
            payloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            accessKeyId: 'AKIAIOSFODNN7EXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
            region: 'us-east-1', now: new Date('2013-05-24T00:00:00Z'),
        })
        assert.equal(headers.authorization, 'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, ' +
            'SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41')
    })
})

describe('S3 client', () => {
    it('puts, measures, gets and lists objects, signing every request', async () => {
        const objects = new Map()
        const credentials = { accessKeyId: 'AK', secretAccessKey: 'SECRET' }
        const server = createServer((req, res) => {
            const chunks = []
            req.on('data', c => chunks.push(c))
            req.on('end', () => {
                const url = `http://${req.headers.host}${req.url}`
                // The server recomputes the signature from what it received
                const expected = signRequest({
                    method: req.method, url, payloadHash: req.headers['x-amz-content-sha256'],
                    headers: Object.fromEntries(['content-type', 'content-length'].filter(h => req.headers[h]).map(h => [h, req.headers[h]])),
                    ...credentials, now: new Date(req.headers['x-amz-date'].replace(/(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)Z/, '$1-$2-$3T$4:$5:$6Z')),
                })
                if (expected.authorization !== req.headers.authorization) { res.statusCode = 403; return res.end('bad signature') }
                const u = new URL(url)
                const key = decodeURIComponent(u.pathname.replace(/^\/bucket\//, ''))
                if (req.method === 'PUT') { objects.set(key, Buffer.concat(chunks)); return res.end() }
                if (req.method === 'HEAD') {
                    if (!objects.has(key)) { res.statusCode = 404; return res.end() }
                    res.setHeader('content-length', objects.get(key).length)
                    return res.end()
                }
                if (u.searchParams.get('list-type') === '2') {
                    const prefix = u.searchParams.get('prefix')
                    const items = [...objects.entries()].filter(([k]) => k.startsWith(prefix))
                        .map(([k, v], i) => `<Contents><Key>${k}</Key><LastModified>2026-10-0${i + 1}T03:30:00Z</LastModified><Size>${v.length}</Size></Contents>`)
                    return res.end(`<ListBucketResult>${items.join('')}</ListBucketResult>`)
                }
                res.end(objects.get(key))
            })
        })
        await new Promise(resolve => server.listen(0, resolve))
        try {
            const s3 = s3Client({ endpoint: `http://127.0.0.1:${server.address().port}`, bucket: 'bucket', ...credentials })
            await s3.put('libra/libra-2026-10-04-0330-full.sql.gz.enc', Buffer.from('one'))
            await s3.put('libra/libra-2026-10-05-0330-full.sql.gz.enc', Buffer.from('second'))
            assert.equal(await s3.size('libra/libra-2026-10-04-0330-full.sql.gz.enc'), 3)
            assert.equal(await s3.size('libra/missing'), null)
            assert.equal((await s3.get('libra/libra-2026-10-05-0330-full.sql.gz.enc')).toString(), 'second')
            assert.deepEqual((await s3.list('libra/')).map(o => o.key), [
                'libra/libra-2026-10-04-0330-full.sql.gz.enc', 'libra/libra-2026-10-05-0330-full.sql.gz.enc'])
            assert.equal(await resolveKey(s3, 'libra'), 'libra/libra-2026-10-05-0330-full.sql.gz.enc')
            await assert.rejects(resolveKey(s3, 'mare'), /No backup under mare\//)

            const wrong = s3Client({ endpoint: `http://127.0.0.1:${server.address().port}`, bucket: 'bucket', accessKeyId: 'AK', secretAccessKey: 'wrong' })
            await assert.rejects(wrong.put('x', Buffer.from('x')), /403/)
        } finally {
            server.close()
        }
    })
})

describe('encryption', () => {
    it('decrypts with the private key only, and refuses an altered file', () => {
        const encrypted = encryptBackup(Buffer.from(DUMP), publicKey)
        assert.ok(!encrypted.includes(Buffer.from('INSERT INTO')))
        assert.equal(decryptBackup(encrypted, privateKey).toString(), DUMP)
        assert.throws(() => decryptBackup(encrypted, other.privateKey))
        const altered = Buffer.from(encrypted)
        altered[altered.length - 20] ^= 1
        assert.throws(() => decryptBackup(altered, privateKey))
        assert.throws(() => decryptBackup(Buffer.from(DUMP), privateKey), /Not an encrypted/)
    })
})

describe('daily backup', () => {
    const env = {
        MYSQL_URL: 'mysql://root:pw@mysql.railway.internal:3306/railway', BACKUP_PUBLIC_KEY: publicKey,
        BACKUP_S3_ENDPOINT: 'https://acc.r2.cloudflarestorage.com', BACKUP_S3_BUCKET: 'backups',
        BACKUP_S3_ACCESS_KEY_ID: 'AK', BACKUP_S3_SECRET_ACCESS_KEY: 'SECRET', BACKUP_PREFIX: 'libra',
    }
    const fakeS3 = (sizeOverride) => {
        const objects = new Map()
        return { objects, put: async (k, b) => { objects.set(k, b) }, size: async k => sizeOverride ?? objects.get(k)?.length ?? null }
    }
    const deps = (s3, logs = []) => ({
        dump: async ({ url, file, local }) => { assert.equal(url, env.MYSQL_URL); assert.equal(local, true); writeFileSync(file, DUMP) },
        validate: () => ({ size: DUMP.length, tables: 1, inserts: 1, lastMigration: '006_idempotency_keys.sql' }),
        s3, log: m => logs.push(m), now: new Date(2026, 9, 4, 3, 30), tmpDir: tmp,
    })

    it('dumps, encrypts and uploads; the object decrypts to the dump', async () => {
        const s3 = fakeS3()
        const logs = []
        const result = await runBackup(env, deps(s3, logs))
        assert.equal(result.key, 'libra/libra-2026-10-04-0330-full.sql.gz.enc')
        assert.equal(decryptBackup(s3.objects.get(result.key), privateKey).toString(), DUMP)
        // Nothing left on disk, no secret in the logs
        assert.deepEqual(readdirSync(tmp).filter(f => f.startsWith('backup-')), [])
        assert.ok(!logs.join('\n').includes('pw') && !logs.join('\n').includes('SECRET'))
    })

    it('accepts the public key with escaped newlines (one-line variable)', async () => {
        const s3 = fakeS3()
        await runBackup({ ...env, BACKUP_PUBLIC_KEY: publicKey.replace(/\n/g, '\\n') }, deps(s3))
        assert.equal(s3.objects.size, 1)
    })

    it('fails when the bucket does not hold the whole file', async () => {
        await assert.rejects(runBackup(env, deps(fakeS3(5))), /bucket reports 5 bytes/)
    })

    it('fails on missing configuration, naming it', async () => {
        await assert.rejects(runBackup({ ...env, BACKUP_PUBLIC_KEY: '' }, deps(fakeS3())), /BACKUP_PUBLIC_KEY/)
        assert.throws(() => backupPrefix({}), /BACKUP_PREFIX/)
        assert.throws(() => backupPrefix({ BACKUP_PREFIX: '../x' }), /BACKUP_PREFIX/)
        assert.equal(backupPrefix({ CLIENT_SLUG: 'mare' }), 'mare')
    })

    it('fails on an invalid dump, uploading nothing', async () => {
        const s3 = fakeS3()
        await assert.rejects(runBackup(env, { ...deps(s3), validate: () => { throw new Error('dump.sql is incomplete') } }), /incomplete/)
        assert.equal(s3.objects.size, 0)
    })
})

describe('restore', () => {
    it('writes the decrypted dump outside the repository, never inside', () => {
        const encrypted = encryptBackup(Buffer.from(DUMP), publicKey)
        const out = path.join(tmp, 'restored')
        // Written, then validated: this fake dump lacks the main tables
        assert.throws(() => writeDecrypted(encrypted, 'libra/libra-x-full.sql.gz.enc', { privateKey, out }), /lacks the tables/)
        assert.ok(existsSync(path.join(out, 'libra-x-full.sql')))
        assert.throws(() => writeDecrypted(encrypted, 'x.enc', { privateKey, out: path.resolve('scripts') }), /inside the repository/)
    })
})

describe('Sentry alert', () => {
    it('sends an envelope to the DSN, or nothing without one', async () => {
        const calls = []
        const fetchImpl = async (url, init) => { calls.push({ url, init }); return { ok: true } }
        assert.equal(await sentryAlert('', 'x', { fetchImpl }), false)
        assert.equal(calls.length, 0)
        assert.equal(await sentryAlert('https://pub@o1.ingest.sentry.io/42', 'Backup failed: boom', { tags: { client: 'libra' }, fetchImpl }), true)
        assert.equal(calls[0].url, 'https://o1.ingest.sentry.io/api/42/envelope/')
        assert.match(calls[0].init.headers['x-sentry-auth'], /sentry_key=pub/)
        const [, , event] = calls[0].init.body.split('\n').map(JSON.parse)
        assert.equal(event.message.formatted, 'Backup failed: boom')
        assert.deepEqual(event.tags, { client: 'libra' })
        assert.equal(await sentryAlert('https://pub@o1.ingest.sentry.io/42', 'x', { fetchImpl: async () => { throw new Error('offline') } }), false)
    })
})
