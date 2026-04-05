CREATE TABLE `automation_programs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`description` text,
	`templateId` varchar(64),
	`stagesJson` json NOT NULL,
	`isActive` int NOT NULL DEFAULT 0,
	`currentStage` int NOT NULL DEFAULT 0,
	`cookSessionId` int,
	`startedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `automation_programs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cook_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`grillId` varchar(128) NOT NULL,
	`templateId` varchar(64),
	`meatType` varchar(64),
	`cutName` varchar(128),
	`method` varchar(32),
	`notes` text,
	`rating` int,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`endedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cook_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `telemetry_readings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`grillId` varchar(128) NOT NULL,
	`cookSessionId` int,
	`grillTemp` float NOT NULL,
	`probeTemp` float,
	`ambientTemp` float,
	`targetTemp` float,
	`pelletLevel` int,
	`systemStatus` int,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `telemetry_readings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `traeger_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`traegerEmail` varchar(320) NOT NULL,
	`accessToken` text NOT NULL,
	`idToken` text NOT NULL,
	`refreshToken` text NOT NULL,
	`expiresAt` bigint NOT NULL,
	`selectedGrillId` varchar(128),
	`grillsJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `traeger_sessions_id` PRIMARY KEY(`id`)
);
