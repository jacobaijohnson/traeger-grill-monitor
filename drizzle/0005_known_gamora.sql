ALTER TABLE `automation_programs` MODIFY COLUMN `stagesJson` json;--> statement-breakpoint
ALTER TABLE `automation_programs` ADD `grillId` varchar(128);--> statement-breakpoint
ALTER TABLE `automation_programs` ADD `category` varchar(32);--> statement-breakpoint
ALTER TABLE `automation_programs` ADD `method` varchar(32);--> statement-breakpoint
ALTER TABLE `automation_programs` ADD `meatCut` varchar(128);--> statement-breakpoint
ALTER TABLE `automation_programs` ADD `difficulty` varchar(16) DEFAULT 'intermediate';--> statement-breakpoint
ALTER TABLE `automation_programs` ADD `estimatedTime` varchar(32);--> statement-breakpoint
ALTER TABLE `automation_programs` ADD `tags` json;--> statement-breakpoint
ALTER TABLE `automation_programs` ADD `programJson` json NOT NULL;--> statement-breakpoint
ALTER TABLE `automation_programs` ADD `variableValuesJson` json;--> statement-breakpoint
ALTER TABLE `automation_programs` ADD `executionLogJson` json;--> statement-breakpoint
ALTER TABLE `automation_programs` ADD `status` varchar(16) DEFAULT 'ready' NOT NULL;--> statement-breakpoint
ALTER TABLE `automation_programs` ADD `isPublished` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `automation_programs` ADD `authorName` varchar(128);--> statement-breakpoint
ALTER TABLE `automation_programs` ADD `forkCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `automation_programs` ADD `forkedFromId` int;