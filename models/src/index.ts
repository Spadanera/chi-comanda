import { RowDataPacket } from "mysql2"

export interface Type {
  name: string
  type: string
}

export const ItemTypes:Type[] = [
  {
    name: "Birra",
    type: "Bevanda"
  },
  {
    name: "Cocktail",
    type: "Bevanda"
  },
  {
    name: "Analcolico",
    type: "Bevanda"
  },
  {
    name: "Extra",
    type: "Bevanda"
  },
  {
    name: "Special",
    type: "Cibo"
  },
  {
    name: "Piadina",
    type: "Cibo"
  },
  {
    name: "Panino",
    type: "Cibo"
  },
  {
    name: "Fuori Menu",
    type: "Bevanda"
  },
  {
    name: "Sconto",
    type: ""
  }
]

export interface CompleteOrderInput {
  event_id: number,
  table_id: number,
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
  data?: any
}

export interface Event extends Repository {
  id?: number
  name?: string
  date?: Date
  menu_id?: number
  tables?: Table[]
  workers?: User[]
  orders?: Order[]
  tableCount?: number
  foodCount?: number
  beverageCount?: number
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
  beverageCount?: number,
  foodCount?: number
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
  available?: boolean
  status?: string
  menu_id?: number
}

export interface Destination extends Repository {
  id?: number
  name?: string
  status?: string
  canDelete?: number
}