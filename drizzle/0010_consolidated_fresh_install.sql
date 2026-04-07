-- Consolidated fresh-install migration for Traeger Grill Monitor
-- This file creates ALL application tables from scratch, matching drizzle/schema.ts.
-- Better Auth tables (user, session, account, verification) are handled separately
-- by Better Auth's own migration system.
--
-- All userId columns are VARCHAR(36) to match Better Auth's UUID user IDs.
-- Uses IF NOT EXISTS for idempotent execution.

-- ─── Core Tables ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS `traeger_sessions` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `userId` VARCHAR(36) NOT NULL,
  `traegerEmail` VARCHAR(320) NOT NULL,
  `accessToken` TEXT NOT NULL,
  `idToken` TEXT NOT NULL,
  `refreshToken` TEXT NOT NULL,
  `expiresAt` BIGINT NOT NULL,
  `selectedGrillId` VARCHAR(128),
  `grillsJson` JSON,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `traeger_sessions_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `telemetry_readings` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `userId` VARCHAR(36) NOT NULL,
  `grillId` VARCHAR(128) NOT NULL,
  `cookSessionId` INT,
  `grillTemp` FLOAT NOT NULL,
  `probeTemp` FLOAT,
  `ambientTemp` FLOAT,
  `targetTemp` FLOAT,
  `targetProbeTemp` FLOAT,
  `pelletLevel` INT,
  `systemStatus` INT,
  `recordedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `telemetry_readings_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `cook_sessions` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `userId` VARCHAR(36) NOT NULL,
  `grillId` VARCHAR(128) NOT NULL,
  `templateId` VARCHAR(64),
  `meatType` VARCHAR(64),
  `cutName` VARCHAR(128),
  `method` VARCHAR(32),
  `notes` TEXT,
  `rating` INT,
  `status` VARCHAR(16) NOT NULL DEFAULT 'active',
  `stagesJson` JSON,
  `alertsJson` JSON,
  `currentStage` INT NOT NULL DEFAULT 0,
  `peakGrillTemp` FLOAT,
  `peakProbeTemp` FLOAT,
  `startedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `endedAt` TIMESTAMP,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `cook_sessions_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `cook_alerts` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `userId` VARCHAR(36) NOT NULL,
  `grillId` VARCHAR(128),
  `cookSessionId` INT NOT NULL,
  `alertType` VARCHAR(16) NOT NULL,
  `label` VARCHAR(128) NOT NULL,
  `triggerTemp` FLOAT NOT NULL,
  `triggerType` VARCHAR(16) NOT NULL DEFAULT 'probe',
  `status` VARCHAR(16) NOT NULL DEFAULT 'pending',
  `firedAt` TIMESTAMP,
  `dismissedAt` TIMESTAMP,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `cook_alerts_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `pellet_logs` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `userId` VARCHAR(36) NOT NULL,
  `grillId` VARCHAR(128) NOT NULL,
  `cookSessionId` INT,
  `pelletLevel` INT NOT NULL,
  `estimatedLbs` FLOAT,
  `burnRateLbsPerHr` FLOAT,
  `grillTemp` FLOAT,
  `recordedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `pellet_logs_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `automation_programs` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `userId` VARCHAR(36) NOT NULL,
  `grillId` VARCHAR(128),
  `name` VARCHAR(128) NOT NULL,
  `description` TEXT,
  `category` VARCHAR(32),
  `method` VARCHAR(32),
  `meatCut` VARCHAR(128),
  `difficulty` VARCHAR(16) DEFAULT 'intermediate',
  `estimatedTime` VARCHAR(32),
  `tags` JSON,
  `templateId` VARCHAR(64),
  `programJson` JSON NOT NULL,
  `stagesJson` JSON,
  `variableValuesJson` JSON,
  `executionLogJson` JSON,
  `status` VARCHAR(16) NOT NULL DEFAULT 'ready',
  `isActive` INT NOT NULL DEFAULT 0,
  `currentStage` INT NOT NULL DEFAULT 0,
  `cookSessionId` INT,
  `isPublished` INT NOT NULL DEFAULT 0,
  `authorName` VARCHAR(128),
  `forkCount` INT NOT NULL DEFAULT 0,
  `forkedFromId` INT,
  `startedAt` TIMESTAMP,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `automation_programs_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `custom_templates` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `userId` VARCHAR(36) NOT NULL,
  `authorName` VARCHAR(128),
  `name` VARCHAR(128) NOT NULL,
  `description` TEXT,
  `category` VARCHAR(32) NOT NULL,
  `method` VARCHAR(32) NOT NULL,
  `meatCut` VARCHAR(128),
  `difficulty` VARCHAR(16) NOT NULL DEFAULT 'intermediate',
  `estimatedTime` VARCHAR(32),
  `stagesJson` JSON NOT NULL,
  `tipsJson` JSON,
  `isPublished` INT NOT NULL DEFAULT 0,
  `forkCount` INT NOT NULL DEFAULT 0,
  `forkedFromId` INT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `custom_templates_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `program_executions` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `userId` VARCHAR(36) NOT NULL,
  `automationProgramId` INT NOT NULL,
  `programName` VARCHAR(128) NOT NULL,
  `programCategory` VARCHAR(32),
  `programMethod` VARCHAR(32),
  `programMeatCut` VARCHAR(128),
  `cookSessionId` INT,
  `grillId` VARCHAR(128),
  `variableValuesJson` JSON,
  `stepsCompleted` INT NOT NULL DEFAULT 0,
  `totalSteps` INT NOT NULL DEFAULT 0,
  `outcome` VARCHAR(16) NOT NULL DEFAULT 'running',
  `peakGrillTemp` FLOAT,
  `peakProbeTemp` FLOAT,
  `executionLogJson` JSON,
  `notes` TEXT,
  `rating` INT,
  `startedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `endedAt` TIMESTAMP,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `program_executions_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Access Control & Settings ─────────────────────────

CREATE TABLE IF NOT EXISTS `invite_codes` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `code` VARCHAR(32) NOT NULL,
  `createdByUserId` VARCHAR(36) NOT NULL,
  `createdByName` VARCHAR(128),
  `usedByUserId` VARCHAR(36),
  `usedByEmail` VARCHAR(320),
  `usedAt` TIMESTAMP,
  `expiresAt` TIMESTAMP NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `invite_codes_id` PRIMARY KEY(`id`),
  CONSTRAINT `invite_codes_code_unique` UNIQUE(`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `email_allowlist` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `email` VARCHAR(320) NOT NULL,
  `addedByUserId` VARCHAR(36) NOT NULL,
  `note` VARCHAR(256),
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `email_allowlist_id` PRIMARY KEY(`id`),
  CONSTRAINT `email_allowlist_email_unique` UNIQUE(`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `app_settings` (
  `key` VARCHAR(64) NOT NULL,
  `value` TEXT NOT NULL,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `app_settings_key` PRIMARY KEY(`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Push Notifications ────────────────────────────────

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

CREATE TABLE IF NOT EXISTS `notification_preferences` (
  `userId` VARCHAR(36) PRIMARY KEY,
  `preferences` TEXT NOT NULL,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Performance Indexes ───────────────────────────────
-- Using CREATE INDEX IF NOT EXISTS (MySQL 8.0.29+) where supported,
-- with error suppression for older versions.

-- telemetry_readings
CREATE INDEX `idx_telemetry_user_grill_time` ON `telemetry_readings` (`userId`, `grillId`, `recordedAt`);
CREATE INDEX `idx_telemetry_cook_session` ON `telemetry_readings` (`cookSessionId`);
CREATE INDEX `idx_telemetry_recorded_at` ON `telemetry_readings` (`recordedAt`);

-- automation_programs
CREATE INDEX `idx_automation_user_status` ON `automation_programs` (`userId`, `status`);
CREATE INDEX `idx_automation_user_active` ON `automation_programs` (`userId`, `isActive`);
CREATE INDEX `idx_automation_user_published` ON `automation_programs` (`userId`, `isPublished`);

-- cook_sessions
CREATE INDEX `idx_sessions_user_grill` ON `cook_sessions` (`userId`, `grillId`);
CREATE INDEX `idx_sessions_user_started` ON `cook_sessions` (`userId`, `startedAt`);
CREATE INDEX `idx_sessions_user_status` ON `cook_sessions` (`userId`, `status`);

-- program_executions
CREATE INDEX `idx_executions_user_program` ON `program_executions` (`userId`, `automationProgramId`);
CREATE INDEX `idx_executions_user_started` ON `program_executions` (`userId`, `startedAt`);
CREATE INDEX `idx_executions_user_outcome` ON `program_executions` (`userId`, `outcome`);

-- pellet_logs
CREATE INDEX `idx_pellets_user_grill_time` ON `pellet_logs` (`userId`, `grillId`, `recordedAt`);

-- cook_alerts
CREATE INDEX `idx_alerts_user_session` ON `cook_alerts` (`userId`, `cookSessionId`);

-- traeger_sessions
CREATE INDEX `idx_traeger_sessions_user` ON `traeger_sessions` (`userId`);

-- custom_templates
CREATE INDEX `idx_templates_user` ON `custom_templates` (`userId`);
CREATE INDEX `idx_templates_published` ON `custom_templates` (`isPublished`);
