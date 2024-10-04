FROM node:20-alpine AS build

WORKDIR /models

RUN ls

WORKDIR /app

RUN ls

COPY package*.json .

RUN npm install

COPY . .

# RUN npm run build