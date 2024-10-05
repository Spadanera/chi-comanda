import mysql, { ResultSetHeader, RowDataPacket } from 'mysql2'
import { DbUtils } from "../models"
import { Audit } from "../../../models/src"

const CONNECTION_PARAMS = {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE
}

export default class MySqlUtils implements DbUtils {
    Connection?: mysql.Connection
    Pool?: mysql.Pool

    constructor() {
    }

    connect() {
        this.Connection = mysql.createConnection(CONNECTION_PARAMS)
    }

    poolConnect() {
        this.Pool = mysql.createPool(CONNECTION_PARAMS)
    }

    async query<T extends RowDataPacket>(query: string, values: any): Promise<T[]> {
        this.connect()
        return new Promise((resolve, reject) => {
            this.Connection?.query<T[]>(query, values, (_err, res) => {
                if (_err) {
                    reject(_err)
                }
                else {
                    resolve(res)
                }
            })
        })
    }

    async queryOne<T extends RowDataPacket>(query: string, values: any): Promise<T> {
        var result = await this.query<T>(query, values)
        if (result && result.length) {
            return result[0]
        }
        else {
            throw new Error("Record not found")
        }
    }

    async execute(query: string, values: any, pool: boolean = false): Promise<number> {
        return new Promise((resolve, reject) => {
            if (pool) {
                this.Pool?.query<ResultSetHeader>(query, values, (_err, res) => {
                    if (_err) {
                        reject(_err)
                    }
                    else {
                        resolve(res.insertId || res.affectedRows)
                    }
                })
            }
            else {
                this.connect()
                this.Connection?.query<ResultSetHeader>(query, values, (_err, res) => {
                    if (_err) {
                        reject(_err)
                    }
                    else {
                        resolve(res.insertId || res.affectedRows)
                    }
                })
            }
        })
    }

    async executeTransaction(execution: () => Promise<number>): Promise<number> {
        return new Promise((resolve, reject) => {
            this.poolConnect()
            this.Pool?.getConnection((_err, connection) => {
                this.Connection = connection
                this.Connection?.beginTransaction(async (_err) => {
                    if (_err) {
                        reject(_err)
                    }
                    else {
                        const result = await execution()
                        this.Connection?.commit((_err) => {
                            if (_err) {
                                this.Connection?.rollback(() => {
                                    reject(_err)
                                })
                            }
                            else {
                                resolve(result)
                            }
                        })
                    }
                })
            })
        })
    }

    async trackAudit(audit: Audit): Promise<void> {
        await this.execute("INSERT INTO audit (user_id, event_id, table_id, action, actionData, actionDateTime) VALUES (?, ?, ?, ?, ?, ?)"
            , [audit.user_id, audit.event_id, audit.table_id, audit.action, audit.actionData, audit.actionDateTime])
    }
}
