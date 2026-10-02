import mysql, { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import config from '../config'

type Params = unknown[]
type Executor = Pool | PoolConnection

/** mysql2 rejects `undefined` bind values: map them to NULL. */
function normalize(params: Params = []): any[] {
    return params.map(p => (p === undefined ? null : p))
}

/** Builds `?,?,?` for an IN (...) clause. Callers must guard against empty lists. */
export function placeholders(values: readonly unknown[]): string {
    return values.map(() => '?').join(',')
}

/** Query helpers bound to either the pool or a single transactional connection. */
export class Queryable {
    constructor(protected executor: Executor) { }

    private async run<T>(sql: string, params?: Params): Promise<T> {
        try {
            const [result] = await this.executor.execute(sql, normalize(params))
            return result as T
        } catch (error) {
            console.error('Error executing query:', sql, params)
            throw error
        }
    }

    query<T = any>(sql: string, params?: Params): Promise<T[]> {
        return this.run<(T & RowDataPacket)[]>(sql, params)
    }

    async queryOne<T = any>(sql: string, params?: Params): Promise<T | undefined> {
        return (await this.query<T>(sql, params))[0]
    }

    /** Returns the number of affected rows. */
    async execute(sql: string, params?: Params): Promise<number> {
        return (await this.run<ResultSetHeader>(sql, params)).affectedRows
    }

    /** Returns the id of the inserted row. */
    async insert(sql: string, params?: Params): Promise<number> {
        return (await this.run<ResultSetHeader>(sql, params)).insertId
    }
}

class Database extends Queryable {
    private pool: Pool

    constructor() {
        const pool = mysql.createPool({
            ...config.db,
            connectionLimit: 50,
            waitForConnections: true,
            queueLimit: 0,
        })
        super(pool)
        this.pool = pool
    }

    /** Runs `work` inside a transaction, committing on success and rolling back on any error. */
    async transaction<T>(work: (tx: Queryable) => Promise<T>): Promise<T> {
        const connection = await this.pool.getConnection()
        try {
            await connection.beginTransaction()
            const result = await work(new Queryable(connection))
            await connection.commit()
            return result
        } catch (error) {
            await connection.rollback()
            throw error
        } finally {
            connection.release()
        }
    }

    async closePool(): Promise<void> {
        await this.pool.end()
    }
}

const db = new Database()

export default db
