import { constants, createCipheriv, createDecipheriv, createPrivateKey, createPublicKey, privateDecrypt, publicEncrypt, randomBytes } from 'node:crypto'
import { gunzipSync, gzipSync } from 'node:zlib'

/**
 * Encryption of backups: gzip, then AES-256-GCM with a random key, the key encrypted with an RSA public key (OAEP,
 * SHA-256). Only the public key is given to the cron service: whoever reads the bucket (or the service's variables)
 * still can't read a backup; the private key stays offline with the owner.
 *
 * File layout: "CCBK1\n" | key length (uint16 BE) | RSA-encrypted key | IV (12) | ciphertext | GCM tag (16)
 */

const MAGIC = Buffer.from('CCBK1\n')
const OAEP = { padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }

export function encryptBackup(plain, publicKeyPem) {
    const publicKey = createPublicKey(publicKeyPem)
    const key = randomBytes(32)
    const iv = randomBytes(12)
    const wrapped = publicEncrypt({ key: publicKey, ...OAEP }, key)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const body = Buffer.concat([cipher.update(gzipSync(plain)), cipher.final()])
    const length = Buffer.alloc(2)
    length.writeUInt16BE(wrapped.length)
    return Buffer.concat([MAGIC, length, wrapped, iv, body, cipher.getAuthTag()])
}

/** Throws on a wrong key or a damaged/altered file (GCM authentication). */
export function decryptBackup(data, privateKeyPem, passphrase) {
    if (!data.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Not an encrypted Chi Comanda backup')
    let offset = MAGIC.length
    const length = data.readUInt16BE(offset)
    offset += 2
    const wrapped = data.subarray(offset, offset + length)
    offset += length
    const iv = data.subarray(offset, offset + 12)
    offset += 12
    const tag = data.subarray(data.length - 16)
    const key = privateDecrypt({ key: createPrivateKey({ key: privateKeyPem, passphrase }), ...OAEP }, wrapped)
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    return gunzipSync(Buffer.concat([decipher.update(data.subarray(offset, data.length - 16)), decipher.final()]))
}
