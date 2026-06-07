CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_user_id` text,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text,
	`before` text,
	`after` text,
	`meta` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_log_actor_idx` ON `audit_log` (`actor_user_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `audit_log_entity_idx` ON `audit_log` (`entity`,`entity_id`);
--> statement-breakpoint
CREATE INDEX `audit_log_action_idx` ON `audit_log` (`action`);
--> statement-breakpoint
CREATE INDEX `audit_log_created_idx` ON `audit_log` (`created_at`);
