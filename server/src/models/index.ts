import { RowDataPacket } from "mysql2"

export interface DbUtils {
  connect(): void
  poolConnect(): void
  query<T extends RowDataPacket>(query: string, values: any): Promise<T[]>
  execute(query: string, values: any, pool: boolean): Promise<number>
  executeTransaction(execution: () => Promise<number>): Promise<number>
}