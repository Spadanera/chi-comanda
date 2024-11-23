import { RowDataPacket } from "mysql2"

export interface Type extends RowDataPacket {
  id?: number
  name: string
  icon?: string
  numProducts?: number
}

export interface SubType extends RowDataPacket {
  id?: number
  name: string
  type_id?: number
  icon?: string
  type?: string
  numProducts?: number
}

export interface CompleteOrderInput {
  event_id?: number,
  table_id?: number,
  order_id?: number,
  item_ids: number[]
}

export interface Message {
  room?: string
  rooms?: string[]
  event: string
  body?: any
}

export interface Repository extends RowDataPacket {

}

export interface Invitation extends User {
  
}

export interface Audit extends Repository {
  id?: number,
  user_id?: number,
  method?: string,
  path?: string,
  data?: any,
  dateTime?: string
}

export interface Event extends Repository {
  id?: number
  name?: string
  date?: Date
  menu_id?: number
  tables?: Table[]
  users?: User[]
  orders?: Order[]
  tableCount?: number
  revenue?: number
  discount?: number
  currentPaid?: number
  tablesOpen?: number
  menu_name?: string
}

export interface Table extends Repository {
  id?: number
  event_id?: number
  order_id?: number
  table_id?: number
  master_table_id?: number[]
  name?: string
  paid?: boolean
  status?: string
  user?: User
  items?: Item[]
  discuntItems?: Item[]
}

export interface AvailableTable extends Repository {
  table_id?: number
  table_name?: string
  master_table_id?: number
  master_table_name?: string
  default_seats?: number
  event_id?: number
}

export interface Order extends Repository {
  id?: number
  event_id?: number
  table_id?: number
  table_name?: string
  master_table_id?: number
  done?: boolean
  order_date?: string
  user_id?: string
  user?: User
  minPassed?: number
  items?: Item[]
  itemsToDo?: Item[]
  itemsDone?: Item[]
}

export interface Item extends Repository {
  id?: number
  table_id?: number
  order_id?: number
  master_item_id?: number
  type?: string
  sub_type?: string
  icon?: string
  note?: string
  done?: boolean
  paid?: boolean
  price?: number
  destination_id?: number
  grouped_ids?: number[]
}

export interface MasterTable extends Repository {
  id?: number
  name?: string
  default_seats?: number
  status?: string
  inUse?: boolean
}

export interface User extends Repository {
  id?: number
  username?: string
  email?: string
  password?: string
  roles?: string[],
  status?: string,
  statusSwitch?: boolean,
  creation_date?: string
}

export interface Role extends Repository {
  id?: number
  name?: string
}

export interface Menu extends Repository {
  id?: number
  name?: string
  status?: string
  from_id?: number
}

export interface MasterItem extends Repository {
  id?: number
  name?: string
  type?: string
  sub_type?: string
  price?: number
  destination_id?: number
  destination?: string
  available?: boolean | number
  status?: string
  menu_id?: number
}

export interface Destination extends Repository {
  id?: number
  name?: string
  status?: string
  canDelete?: number
  minute_to_alert?: number
}

export interface Transaction extends Repository {
  id?: number,
  date_time?: Date
  provider?: 'Contanti' | 'SumUp'
  providerInfo?: SumUpTransactionInfo
}

export interface PaymentProviderBase {
  name: string
  docUrl?: string
  image: string
  type: 'sumup'
  description: string
}

export interface PaymentProvider extends Repository {
  id?: number
  name: string
  creation_date?: Date
  type: 'SumUp'
  status: 'ACTIVE' | 'PAUSED' | 'DELETED'
  access_info: AccessInfo
}

export type AccessInfo = SumUpAccessInfo

export interface SumUpAccessInfo {
  merchant_code: string
  api_key: string
}

export interface SumUpTransactionInfo {
  merchant_code?: string
  transaction_id?: string
  foreign_transaction_id?: string
  description?: string
  total_amount?: number
  client_transaction_id?: number
}