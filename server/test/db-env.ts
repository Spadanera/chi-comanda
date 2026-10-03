/** Connection to the disposable test MySQL started by `npm run test:db`. */
export const TEST_DB = {
    host: process.env.TEST_MYSQL_HOST || '127.0.0.1',
    port: +(process.env.TEST_MYSQL_PORT || 3317),
    user: 'user',
    password: 'password',
    database: 'railway',
    /** Root can create the scratch databases used by the migration tests. */
    rootPassword: 'password',
}
