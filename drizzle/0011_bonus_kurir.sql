CREATE TABLE `bonus_kurir` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kurir_user_id` text NOT NULL,
	`order_id` integer NOT NULL,
	`jumlah_galon` integer NOT NULL,
	`rate_per_galon` integer NOT NULL,
	`total` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`paid_at` integer,
	`paid_by` text,
	`catatan` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`kurir_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`paid_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `bonus_kurir_order_unique_idx` ON `bonus_kurir` (`order_id`);--> statement-breakpoint
CREATE INDEX `bonus_kurir_kurir_status_idx` ON `bonus_kurir` (`kurir_user_id`,`status`);--> statement-breakpoint
CREATE INDEX `bonus_kurir_kurir_date_idx` ON `bonus_kurir` (`kurir_user_id`,`created_at`);
