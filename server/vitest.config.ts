import { defineConfig } from 'vitest/config'
import webpush from 'web-push'

const vapid = webpush.generateVAPIDKeys()

export default defineConfig({
    test: {
        include: ['test/**/*.test.ts'],
        fileParallelism: false,
        testTimeout: 20000,
        hookTimeout: 60000,
        env: {
            MYSQL_HOST: process.env.TEST_MYSQL_HOST || '127.0.0.1',
            MYSQL_PORT: process.env.TEST_MYSQL_PORT || '3317',
            MYSQL_USER: 'user',
            MYSQL_PASSWORD: 'password',
            MYSQL_DATABASE: 'railway',
            SECRET: 'test-secret',
            BASE_URL: 'http://localhost',
            GOOGLE_CLIENT_ID: 'test-client-id',
            GOOGLE_CLIENT_SECRET: 'test-client-secret',
            VAPID_PUBLIC_KEY: vapid.publicKey,
            VAPID_PRIVATE_KEY: vapid.privateKey,
        },
    },
})
