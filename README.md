# Ludo Project - Web App

App for handling order in a bar

## Run the application

To run the application it is necessary docker and docker-compose installed on your machine. Moreover you need Grunt installed globally

First of all, clone this repository. After that run the following command in the root folder:

```
npm build
```

The application is using Mailjet to send email (invitatation and reset password). Before starting, you have to create an .env file in the root of the project with the following evn variable:

```
MAIL_API_KEY=[your mailjet api key]
MAIL_API_SECRET=[your mailjet api secret]
SUPERUSER_EMAIL=[your email address, so you can do the reset password procedure for the superuser]
```

```
npm start
```

After that you can access the application at:

http://localhost

You need to do the reset password procedure to access the website

## Docker structure

There are 4 services defined in docker compose:

1. client: node18 image that hosts the client of the application based on VUE.js
2. server: node:18 image that hosts the API 
3. server-database: MySql image
4. proxy: nginx image that works as proxy between client and server