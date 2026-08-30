-- 004_notifications_link.sql
-- Idempotent: add an optional deep-link to a notification (e.g. the
-- application page). Written with an information_schema guard so it works on
-- both MariaDB and MySQL.

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'notifications'
    AND COLUMN_NAME = 'link'
);

SET @ddl := IF(
  @col_exists = 0,
  'ALTER TABLE notifications ADD COLUMN link VARCHAR(255) NULL AFTER message',
  'SELECT 1'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
