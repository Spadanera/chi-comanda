import config from './config'
import db from './db'
import { server, sessionStore } from './app'
import { disconnectAll } from './socket'

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
