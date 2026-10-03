-- Branding the admin changes from the interface: venue name, logo and theme colours. A single row (id = 1);
-- NULL means "use the default" (CLIENT_NAME, the Chi Comanda logo, the Art Déco palette).
CREATE TABLE IF NOT EXISTS `settings` (
  `id` TINYINT NOT NULL,
  `venue_name` VARCHAR(100) NULL,
  -- PNG, 512x512
  `logo` MEDIUMBLOB NULL,
  `primary_color` CHAR(7) NULL,
  `secondary_color` CHAR(7) NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `settings_single_row` CHECK (`id` = 1)
);

INSERT IGNORE INTO `settings` (`id`) VALUES (1);
