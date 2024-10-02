import { RowDataPacket } from "mysql2"

export interface DbUtils {
  connect(): void
  poolConnect(): void
  query<T extends RowDataPacket>(query: string, values: any): Promise<T[]>
  execute(query: string, values: any, pool: boolean): Promise<number>
  executeTransaction(execution: () => Promise<number>): Promise<number>
}

export interface Event extends RowDataPacket {
  id?: number
  name?: string
  date?: Date
  tables?: Table[]
  workers?: Worker[]
  orders?: Order[]
}

export interface Table extends RowDataPacket {
  id?: number
  event_id?: number
  master_table_id?: number[]
  name: string
  status?: string
}

export interface Order extends RowDataPacket {
  id?: number
  event_id?: number
  table_id?: number
  table_name?: string
  master_table_id?: number[]
  worker_id?: number
  done?: boolean
  paid?: boolean
  items?: Item[]
  worker?: Worker
}

export interface Item extends RowDataPacket {
  id?: number
  order_id?: number
  master_item_id?: number
  note?: string
  done?: boolean
  paid?: boolean
}

export interface MasterTable extends RowDataPacket {
  id?: number
  name?: string
}

export interface Worker extends RowDataPacket {
  id?: number
  user_id?: number
  role?: string
}

export interface User extends RowDataPacket {
  id?: number
  name?: string
  password?: string
}

export interface Role extends RowDataPacket {
  id?: number
  name?: string
}

export interface MasterItem extends RowDataPacket {
  id?: number
  name?: string
  type?: string
  price?: number
  destination_id?: number
}

export interface Destination extends RowDataPacket {
  id?: number
  name?: string
  location?: string
}