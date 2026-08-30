CREATE TABLE `fcm_token` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`platform` text DEFAULT 'android' NOT NULL,
	`user_agent` text,
	`last_seen_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fcm_token_token_unique` ON `fcm_token` (`token`);
--> statement-breakpoint
CREATE INDEX `fcm_token_user_idx` ON `fcm_token` (`user_id`);
