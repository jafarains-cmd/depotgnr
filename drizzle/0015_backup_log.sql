CREATE TABLE `backup_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ran_at` integer NOT NULL,
	`status` text NOT NULL,
	`size_bytes` integer,
	`file_url` text,
	`file_id` text,
	`error` text,
	`duration_ms` integer,
	`triggered_by` text NOT NULL,
	`triggered_by_user_id` text,
	FOREIGN KEY (`triggered_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `backup_log_ran_at_idx` ON `backup_log` (`ran_at`);
