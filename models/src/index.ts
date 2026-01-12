import { RowDataPacket } from "mysql2"

export type shape = 'rect' | 'circle'

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

export interface Broadcast extends Repository {
  sender: User
  event_id: number
  message: string
  dateTime?: Date
  receivers: number[]
}

export interface Repository extends RowDataPacket {

}

export interface Invitation extends User {
  
}

export interface Audit extends Repository {
  id?: number,
  user_id?: number,
  username?: string,
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
  minimumConsumptionPrice?: number
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

export interface AvailableTable extends MasterTable {
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
  setMinimum?: boolean
}

export interface MasterTable extends Repository {
  id?: number
  name?: string
  default_seats?: number
  status?: string
  inUse?: boolean
  room_id: number
  x: number
  y: number
  width: number
  height: number
  shape: shape
}

export interface Room extends Repository {
  id: number
  name: string
  width: number
  height: number
  tables: Table[]
  activeTableCount?: number
}

export interface RestaurantLayout extends Repository {
  rooms: Room[],
  tables: MasterTable[]
}

export interface TableUpdatePayload {
  id: number;
  x: number;
  y: number;
}

export interface User extends Repository {
  id?: number
  username?: string
  email?: string
  password?: string
  roles?: string[],
  status?: string,
  statusSwitch?: boolean,
  creation_date?: string,
  avatar?: any
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