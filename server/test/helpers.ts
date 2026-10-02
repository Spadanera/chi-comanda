import mysql from 'mysql2/promise'
import bcrypt from 'bcrypt'
import request from 'supertest'
import { vi } from 'vitest'

vi.mock('../src/utils/mail', () => ({ default: vi.fn(async () => undefined) }))

export const PASSWORD = 'Password1!'

export const ROLE_USERS = {
    superuser: 'super@test.local',
    admin: 'admin@test.local',
    checkout: 'checkout@test.local',
    waiter: 'waiter@test.local',
    bartender: 'bartender@test.local',
    client: 'client@test.local',
} as const

export type RoleName = keyof typeof ROLE_USERS

export function rawConnection() {
    return mysql.createConnection({
        host: process.env.MYSQL_HOST,
        port: +(process.env.MYSQL_PORT || 3306),
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
        multipleStatements: true,
    })
}

const VOLATILE_TABLES = [
    'payment_transactions', 'payment_settings', 'audit', 'sessions', 'reset',
    'items', 'items_history', 'orders', 'orders_history', 'table_master_table',
    'tables', 'tables_history', 'master_tables_event', 'user_event', 'events',
]

/** Wipes runtime data and (re)creates one active user per role. Seed data from init.sql is kept. */
export async function resetDatabase(): Promise<Record<RoleName, number>> {
    const conn = await rawConnection()
    try {
        await conn.query('SET FOREIGN_KEY_CHECKS = 0')
        for (const t of VOLATILE_TABLES) {
            await conn.query(`TRUNCATE TABLE ${t}`).catch(() => undefined)
        }
        await conn.query(`DELETE FROM user_role WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.local')`)
        await conn.query(`DELETE FROM users WHERE email LIKE '%@test.local'`)
        await conn.query(`DELETE FROM menu WHERE id > 1`)
        await conn.query(`DELETE FROM master_items WHERE menu_id > 1`)
        await conn.query(`DELETE FROM rooms WHERE id > 2`)
        await conn.query(`UPDATE rooms SET status = 'ACTIVE'`)
        await conn.query(`DELETE FROM master_tables WHERE id > 21`)
        await conn.query(`UPDATE master_tables SET status = 'ACTIVE', room_id = IF(name IN ('Bagni Dx','Bagni Sx','Noire','Bara','Cor 1','Cor 2','Cor 3'), 1, 2)`)
        await conn.query('SET FOREIGN_KEY_CHECKS = 1')

        const hash = await bcrypt.hash(PASSWORD, 4)
        const ids = {} as Record<RoleName, number>
        for (const [role, email] of Object.entries(ROLE_USERS) as [RoleName, string][]) {
            const [res]: any = await conn.query(
                `INSERT INTO users (email, username, password, status) VALUES (?, ?, ?, 'ACTIVE')`,
                [email, role, hash])
            ids[role] = res.insertId
            await conn.query(
                `INSERT INTO user_role (user_id, role_id) SELECT ?, id FROM roles WHERE name = ?`,
                [res.insertId, role])
        }
        return ids
    } finally {
        await conn.end()
    }
}

export async function loadApp() {
    const { app } = await import('../src/app')
    return app
}

export async function loginAs(app: any, role: RoleName) {
    const agent = request.agent(app)
    const res = await agent.post('/api/login').send({ email: ROLE_USERS[role], password: PASSWORD })
    if (res.status !== 200) {
        throw new Error(`Login as ${role} failed: ${res.status} ${JSON.stringify(res.body)}`)
    }
    return agent
}

export async function closeApp() {
    const { default: db } = await import('../src/db')
    await db.closePool()
}
