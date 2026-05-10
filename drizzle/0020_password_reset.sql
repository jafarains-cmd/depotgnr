CREATE TABLE `password_reset` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`method` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_by_user_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `password_reset_token_unique` ON `password_reset` (`token`);--> statement-breakpoint
CREATE INDEX `password_reset_user_method_idx` ON `password_reset` (`user_id`,`method`);--> statement-breakpoint
CREATE INDEX `password_reset_expires_idx` ON `password_reset` (`expires_at`);
