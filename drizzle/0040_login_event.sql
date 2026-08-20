CREATE TABLE `login_event` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text,
	`identifier` text NOT NULL,
	`status` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`fingerprint` text,
	`fail_reason` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `login_event_user_idx` ON `login_event` (`user_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `login_event_fingerprint_idx` ON `login_event` (`fingerprint`);
--> statement-breakpoint
CREATE INDEX `login_event_status_idx` ON `login_event` (`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `login_event_identifier_idx` ON `login_event` (`identifier`,`created_at`);
