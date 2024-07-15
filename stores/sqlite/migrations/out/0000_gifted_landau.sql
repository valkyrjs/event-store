CREATE TABLE `valkyr_contexts` (
	`key` text NOT NULL,
	`stream` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `valkyr_events` (
	`id` text PRIMARY KEY NOT NULL,
	`stream` text NOT NULL,
	`type` text NOT NULL,
	`data` text NOT NULL,
	`meta` text NOT NULL,
	`recorded` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `key_idx` ON `valkyr_contexts` (`key`);--> statement-breakpoint
CREATE INDEX `stream_idx` ON `valkyr_events` (`stream`);--> statement-breakpoint
CREATE INDEX `type_idx` ON `valkyr_events` (`type`);--> statement-breakpoint
CREATE INDEX `recorded_idx` ON `valkyr_events` (`recorded`);--> statement-breakpoint
CREATE INDEX `created_idx` ON `valkyr_events` (`created`);