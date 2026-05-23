CREATE TABLE `komplain_pesan` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`komplain_id` integer NOT NULL,
	`sender_user_id` text NOT NULL,
	`sender_role` text NOT NULL,
	`pesan` text NOT NULL,
	`foto_url` text,
	`read_by_other` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`komplain_id`) REFERENCES `komplain`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sender_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `komplain_pesan_komplain_date_idx` ON `komplain_pesan` (`komplain_id`,`created_at`);
