CREATE TABLE `cook_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`cookSessionId` int NOT NULL,
	`alertType` varchar(16) NOT NULL,
	`label` varchar(128) NOT NULL,
	`triggerTemp` float NOT NULL,
	`triggerType` varchar(16) NOT NULL DEFAULT 'probe',
	`status` varchar(16) NOT NULL DEFAULT 'pending',
	`firedAt` timestamp,
	`dismissedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cook_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `cook_sessions` ADD `status` varchar(16) DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `cook_sessions` ADD `stagesJson` json;--> statement-breakpoint
ALTER TABLE `cook_sessions` ADD `alertsJson` json;--> statement-breakpoint
ALTER TABLE `cook_sessions` ADD `currentStage` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `cook_sessions` ADD `peakGrillTemp` float;--> statement-breakpoint
ALTER TABLE `cook_sessions` ADD `peakProbeTemp` float;--> statement-breakpoint
ALTER TABLE `telemetry_readings` ADD `targetProbeTemp` float;