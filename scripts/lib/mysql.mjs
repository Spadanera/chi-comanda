import { randomUUID } from 'node:crypto'
import { execCommand } from './railway.mjs'

/** Roles of the first superuser: every staff role, as the old seed did. */
const SUPERUSER_ROLES = ['admin', 'checkout', 'waiter', 'bartender', 'superuser']

const quote = value => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

/**
 * MySQL of a client through its public TCP proxy, with the `mysql` client of the official image (no local install).
 * The password travels in the MYSQL_PWD environment variable, never on the command line.
 */
export function mysqlClient({ url, exec = execCommand, image = 'mysql:9' }) {
    const { hostname, port, username, password, pathname } = new URL(url)
    const database = decodeURIComponent(pathname.slice(1))

    async function query(sql) {
        const out = await exec('docker', [
            'run', '--rm', '-i', '-e', 'MYSQL_PWD', image,
            'mysql', '-h', hostname, '-P', port || '3306', '-u', decodeURIComponent(username), '--batch', '--skip-column-names', database,
        ], { input: sql, env: { MYSQL_PWD: decodeURIComponent(password) } })
        return out.split('\n').filter(Boolean).map(line => line.split('\t'))
    }

    return {
        query,
        /**
         * Makes sure `email` is a superuser and returns how: `active` (already set up: no link), or a new invitation
         * token (`invited` for a new user, `reinvited` for a pending one, whose old link is replaced).
         */
        async ensureSuperuser(email) {
            const [row] = await query(`SELECT id, status, token IS NOT NULL FROM users WHERE email = ${quote(email)} AND (status IS NULL OR status != 'DELETED');`)
            if (row && row[1] === 'ACTIVE') return { status: 'active' }
            const token = randomUUID()
            const roles = SUPERUSER_ROLES.map(quote).join(',')
            // NOW(): the server checks the 24h expiry against the database clock
            await query(`START TRANSACTION;
                ${row
                    ? `UPDATE users SET token = ${quote(token)}, creation_date = NOW() WHERE id = ${Number(row[0])};
                       SET @uid = ${Number(row[0])};`
                    : `INSERT INTO users (email, token, creation_date) VALUES (${quote(email)}, ${quote(token)}, NOW());
                       SET @uid = LAST_INSERT_ID();`}
                INSERT INTO user_role (user_id, role_id)
                    SELECT @uid, r.id FROM roles r
                    WHERE r.name IN (${roles})
                      AND NOT EXISTS (SELECT 1 FROM user_role ur WHERE ur.user_id = @uid AND ur.role_id = r.id);
                COMMIT;`)
            return { status: row ? 'reinvited' : 'invited', token }
        },
    }
}
