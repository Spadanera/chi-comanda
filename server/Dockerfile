FROM node:22 AS build

WORKDIR /models

COPY package*.json .

RUN npm install

COPY . .

WORKDIR /app

COPY package*.json .

RUN npm install

COPY . .

# RUN npm run build