-- Invitation and password-reset links expire 24 hours after `creation_date`, but in production the column was a DATE:
-- the time was dropped, so a link sent at 22:00 expired about 2 hours later. Widening to DATETIME keeps every value
-- (existing dates become midnight) and the previous release reads and writes it unchanged.
ALTER TABLE `users` MODIFY `creation_date` DATETIME NULL, MODIFY `last_login_date` DATETIME NULL;
ALTER TABLE `reset` MODIFY `creation_date` DATETIME NULL;
