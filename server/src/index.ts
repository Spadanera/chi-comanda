import config from './config'
import { DEMO_SEED_FILE, migrate } from './db/migrate'

async function main() {
    // Before loading the app: the session store and every query need the migrated schema
    await migrate({ db: config.db, demoSeedFile: config.demoSeed ? DEMO_SEED_FILE : undefined })

    const { default: db } = await import('./db')
    const { server, sessionStore } = await import('./app')
    const { disconnectAll } = await import('./socket')

    server.listen(config.port, () => {
        console.log(`App is listening on port ${config.port}`)
    })

    process.on('SIGTERM', () => {
        console.log('SIGTERM received')
        // Open websockets would keep server.close() waiting forever (until the platform kills the process)
        disconnectAll()
        server.close(async () => {
            await Promise.allSettled([db.closePool(), sessionStore.close()])
            console.log('Database pool closed')
            process.exit(0)
        })
        server.closeIdleConnections()
    })
}

main().catch(error => {
    console.error('Startup failed:', error)
    process.exit(1)
})
