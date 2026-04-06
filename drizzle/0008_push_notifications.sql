-- Push notification subscriptions (Web Push API)
CREATE TABLE IF NOT EXISTS `push_subscriptions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` VARCHAR(36) NOT NULL,
  `endpoint` TEXT NOT NULL,
  `p256dh` VARCHAR(256) NOT NULL,
  `auth` VARCHAR(64) NOT NULL,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  INDEX `idx_push_subs_userId` (`userId`),
  UNIQUE INDEX `idx_push_subs_user_endpoint` (`userId`, `endpoint`(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Per-user notification preferences (JSON blob)
CREATE TABLE IF NOT EXISTS `notification_preferences` (
  `userId` VARCHAR(36) PRIMARY KEY,
  `preferences` TEXT NOT NULL,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
