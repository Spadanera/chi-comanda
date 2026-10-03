import { DEMO_SEED_FILE, migrate } from '../src/db/migrate'
import { TEST_DB } from './db-env'

/** Brings the test database to the current schema, as the server does at startup. */
export default async function setup() {
    const { rootPassword, ...db } = TEST_DB
    await migrate({ db, demoSeedFile: DEMO_SEED_FILE, log: () => undefined })
}
