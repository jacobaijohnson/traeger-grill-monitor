CREATE TABLE `pellet_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`grillId` varchar(128) NOT NULL,
	`cookSessionId` int,
	`pelletLevel` int NOT NULL,
	`estimatedLbs` float,
	`burnRateLbsPerHr` float,
	`grillTemp` float,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pellet_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `cook_alerts` ADD `grillId` varchar(128);