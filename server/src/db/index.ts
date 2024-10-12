import mysql, { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'

class Database {
    private pool: Pool

    constructor() {
        this.pool = mysql.createPool({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE,
            connectionLimit: 50,
            waitForConnections: true,
            queueLimit: 0,
        })
    }

    async getConnection(): Promise<PoolConnection> {
        return this.pool.getConnection()
    }

    async query<T extends RowDataPacket>(query: string, values?: any[]): Promise<T[]> {
        let connection: PoolConnection | null = null
        try {
            connection = await this.getConnection()
            const [rows] = await connection.execute<T[]>(query, values)
            return rows
        } finally {
            if (connection) {
                connection.release()
            }
        }
    }

    async queryOne<T extends RowDataPacket>(query: string, values?: any[]): Promise<T> {
        const result = await this.query<T>(query, values)
        if (result.length) {
            return result[0]
        }
        return {} as T
    }

    async executeUpdate(query: string, values?: any[]): Promise<number> {
        let connection: PoolConnection | null = null
        try {
            connection = await this.getConnection();
            const [result] = await connection.execute<ResultSetHeader>(query, values)
            return result.affectedRows
        } finally {
            if (connection) {
                connection.release()
            }
        }
    }

    async executeInsert(query: string, values?: any[]): Promise<number> {
        let connection: PoolConnection | null = null
        try {
          connection = await this.getConnection()
          const [result] = await connection.execute<ResultSetHeader>(query, values)
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
                const [rows] = await connection.execute(query, values)
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