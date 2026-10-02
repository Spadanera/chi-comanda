import db from "./db"
import { server } from "./app"

const port = process.env.PORT || 3000
server.listen(port, () => {
    console.log(`App is listening on port ${port}`)
})

process.on('SIGTERM', () => {
    console.log('SIGTERM received')
    server.close(() => {
        db.closePool().then(() => {
            console.log('Database pool closed')
            process.exit(0)
        })
    })
})