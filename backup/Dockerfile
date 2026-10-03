# Daily backup of an installation's database (DEPLOY.md, *Automatic daily backups*): the `backup` cron service of each
# Railway project builds this image from the repository root. mysqldump comes with the MySQL image, Node from the
# official Node image; the script needs nothing else.
FROM node:22-slim AS node

FROM mysql:9
COPY --from=node /usr/local/bin/node /usr/local/bin/node
WORKDIR /backup
COPY scripts/backup-cron.mjs scripts/backup-client.mjs ./scripts/
COPY scripts/lib ./scripts/lib
# Not the MySQL server's entrypoint: the container runs the backup and exits (Railway cron)
ENTRYPOINT []
CMD ["node", "scripts/backup-cron.mjs"]
