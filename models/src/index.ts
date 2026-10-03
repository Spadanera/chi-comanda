export type shape = 'rect' | 'circle'

export interface Type {
  id?: number
  name: string
  icon?: string
  numProducts?: number
}

export interface SubType {
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

/** Base of the API entities (kept for the generic constraints of the client). */
export interface Repository { }

export interface Invitation extends User {
  token?: string
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
  status?: string
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
  table_name?: string
  room_id?: number
  revenue?: number
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
  items?: Item[]
  user?: User
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
  name?: string
  event_id?: number
  sub_type_id?: number
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
  quantity?: number
  setMinimum?: boolean
  /** PREMIUM version of a cocktail: the server applies the premium price. */
  premium?: boolean
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
  tables: AvailableTable[]
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
  /** Destination (bar, kitchen...) a bartender serves during an event. */
  destination_id?: number | null
}

export interface Role extends Repository {
  id?: number
  name?: string
}

export interface Menu extends Repository {
  id?: number
  name?: string
  creation_date?: string
  canDelete?: number
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
  sub_type_id?: number
  icon?: string
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

export interface PaymentSetting extends Repository {
  id?: number
  provider: string
  enabled: boolean
  configured?: boolean
  config?: {
    api_key?: string
    currency?: string
    merchant_code?: string
  }
}

export interface PaymentTransaction extends Repository {
  id?: number
  table_id: number
  event_id: number
  provider: string
  external_id?: string
  checkout_reference?: string
  amount: number
  currency: string
  status: string
  item_ids?: number[]
  payment_url?: string
  created_at?: string
}
/** Optional functions of an installation (FEATURES); the list lives in server/src/features.ts. */
export type Feature = 'payments' | 'push' | 'google-login' | 'broadcast' | 'minimum-consumption' | 'premium'

/** GET /api/public/config: read by the client at startup. */
export interface PublicConfig {
  /** Venue name (settings, else CLIENT_NAME); null = "Chi Comanda". */
  name: string | null
  slug: string | null
  features: Feature[]
  /** URL of the venue logo; null = the Chi Comanda logo. */
  logo: string | null
  colors: { primary: string | null, secondary: string | null }
}

/** Branding the admin changes from the interface. null = default. */
export interface Settings {
  venue_name: string | null
  primary_color: string | null
  secondary_color: string | null
  has_logo: boolean
}
