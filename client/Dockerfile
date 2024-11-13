FROM node:18

COPY ./docker/entrypoint.sh /entrypoint/


RUN ["chmod", "+x", "entrypoint/entrypoint.sh"]

# Copy or mount node app here
WORKDIR /data/

COPY package*.json .

RUN npm install

COPY . .

EXPOSE 8080

ENTRYPOINT ["/entrypoint/entrypoint.sh"]

CMD ["npm", "run", "dev"]