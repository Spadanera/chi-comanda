import { defineConfig } from 'vitest/config'
import webpush from 'web-push'
import { TEST_DB } from './test/db-env'

const vapid = webpush.generateVAPIDKeys()

export default defineConfig({
    test: {
        include: ['test/**/*.test.ts'],
        globalSetup: ['test/global-setup.ts'],
        fileParallelism: false,
        testTimeout: 20000,
        hookTimeout: 60000,
        env: {
            MYSQL_HOST: TEST_DB.host,
            MYSQL_PORT: String(TEST_DB.port),
            MYSQL_USER: TEST_DB.user,
            MYSQL_PASSWORD: TEST_DB.password,
            MYSQL_DATABASE: TEST_DB.database,
            SECRET: 'test-secret',
            BASE_URL: 'http://localhost',
            GOOGLE_CLIENT_ID: 'test-client-id',
            GOOGLE_CLIENT_SECRET: 'test-client-secret',
            VAPID_PUBLIC_KEY: vapid.publicKey,
            VAPID_PRIVATE_KEY: vapid.privateKey,
        },
    },
})
