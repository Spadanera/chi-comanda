-- Idempotency keys (README, *Unstable networks*): a client sends `Idempotency-Key: <uuid>` with an order, a table
-- closing, an item payment or a payment transaction; the key is written in the same transaction as the operation, with
-- its answer, so a retry of the same request gets the stored answer instead of a second order.
-- Unique per venue: the same key in another venue is another key. Additive only: the previous release ignores it.

CREATE TABLE IF NOT EXISTS `idempotency_keys` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `venue_id` INT NOT NULL,
  `idem_key` CHAR(36) NOT NULL,
  -- Who sent it (no FK: users are global and may be deleted; a retry by somebody else is refused)
  `user_id` INT NULL,
  -- Method and path, e.g. `PUT /tables/12/complete`
  `scope` VARCHAR(255) NOT NULL,
  -- SHA-256 of the body: the same key with another body is refused
  `request_hash` CHAR(64) NOT NULL,
  `response_status` SMALLINT NOT NULL,
  `response_body` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_venue_key` (`venue_id`, `idem_key`),
  KEY `idx_venue_created` (`venue_id`, `created_at`),
  CONSTRAINT `idempotency_keys_venue` FOREIGN KEY (`venue_id`) REFERENCES `venues` (`id`)
);
