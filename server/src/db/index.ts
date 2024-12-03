import mysql, { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import connection from './connection'

class Database {
    private pool: Pool

    constructor() {
        this.pool = mysql.createPool({
            ...connection,
            connectionLimit: 50,
            waitForConnections: true,
            queueLimit: 0,
        })
    }

    private safeNull(values: any[] | undefined): any[] | undefined {
        if (values) {
            for (let i = 0; i < values.length; i++) {
                values[i] = values[i] === undefined ? null : values[i]
            }
        }
        return values
    }

    async getConnection(): Promise<PoolConnection> {
        return this.pool.getConnection()
    }

    async query<T extends RowDataPacket>(query: string, values?: any[]): Promise<T[]> {
        let connection: PoolConnection | null = null
        try {
            connection = await this.getConnection()
            const [rows] = await connection.execute<T[]>(query, this.safeNull(values))
            return rows
        }
        catch (error: any) {
            console.error("Error executing query: ", query, values)
            throw new Error(error)
        }
        finally {
            if (connection) {
                connection.release()
            }
        }
    }

    async queryOne<T extends RowDataPacket>(query: string, values?: any[]): Promise<T> {
        const result = await this.query<T>(query, this.safeNull(values))
        if (result.length) {
            return result[0]
        }
        return {} as T
    }

    async executeUpdate(query: string, values?: any[]): Promise<number> {
        let connection: PoolConnection | null = null
        try {
            connection = await this.getConnection();
            const [result] = await connection.execute<ResultSetHeader>(query, this.safeNull(values))
            return result.affectedRows
        }
        catch (error: any) {
            console.error("Error executing query: ", query, values)
            throw new Error(error)
        }
        finally {
            if (connection) {
                connection.release()
            }
        }
    }

    async executeInsert(query: string, values?: any[]): Promise<number> {
        let connection: PoolConnection | null = null
        try {
            connection = await this.getConnection()
            const [result] = await connection.execute<ResultSetHeader>(query, this.safeNull(values))
            return result.insertId
        } finally {
            if (connection) {
                connection.release()
            }
        }
    }

    async executeTransaction(queries: string[], valuesArray: any[][] = []): Promise<any> {
        let connection: PoolConnection | null = null
        try {
            connection = await this.getConnection()
            await connection.beginTransaction()

            const results = []
            for (let i = 0; i < queries.length; i++) {
                const query = queries[i]
                const values = valuesArray[i] || []
                const [rows] = await connection.execute(query, this.safeNull(values))
                results.push(rows)
            }

            await connection.commit()
            return results
        } catch (error) {
            if (connection) {
                await connection.rollback()
            }
            throw error
        } finally {
            if (connection) {
                connection.release()
            }
        }
    }

    async closePool(): Promise<void> {
        await this.pool.end()
    }
}

const db = new Database()

export default db