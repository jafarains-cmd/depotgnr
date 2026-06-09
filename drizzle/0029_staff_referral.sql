CREATE TABLE `staff_referral` (
	`user_id` text PRIMARY KEY NOT NULL,
	`kode` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_referral_kode_unique` ON `staff_referral` (`kode`);
--> statement-breakpoint
CREATE TABLE `bonus_referral_staff` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`staff_user_id` text NOT NULL,
	`pelanggan_id` integer NOT NULL,
	`nominal` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`paid_at` integer,
	`paid_by` text,
	`catatan` text,
	`ref_transaksi_id` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`staff_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`paid_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `bonus_referral_staff_staff_status_idx` ON `bonus_referral_staff` (`staff_user_id`,`status`);
--> statement-breakpoint
CREATE INDEX `bonus_referral_staff_pelanggan_idx` ON `bonus_referral_staff` (`pelanggan_id`);
--> statement-breakpoint
ALTER TABLE `pelanggan` ADD `referred_by_user_id` text;
