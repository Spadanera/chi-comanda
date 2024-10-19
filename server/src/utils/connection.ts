var connection = process.env.MYSQL_ENV === 'STG' ? {
    host: process.env.MYSQL_HOST_STG,
    port: parseInt(process.env.MYSQL_PORT_STG || '3306'),
    user: process.env.MYSQL_USER_STG,
    password: process.env.MYSQL_PASSWORD_STG,
    database: process.env.MYSQL_DATABASE_STG
} : {
    host: process.env.MYSQL_HOST,
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE
}

export default connection