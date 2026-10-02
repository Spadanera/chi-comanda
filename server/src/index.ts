import config from './config'
import db from './db'
import { server, sessionStore } from './app'

server.listen(config.port, () => {
    console.log(`App is listening on port ${config.port}`)
})

process.on('SIGTERM', () => {
    console.log('SIGTERM received')
    server.close(async () => {
        await Promise.allSettled([db.closePool(), sessionStore.close()])
        console.log('Database pool closed')
        process.exit(0)
    })
})
