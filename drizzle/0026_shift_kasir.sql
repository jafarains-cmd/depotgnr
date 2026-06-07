CREATE TABLE `shift_kasir` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kasir_user_id` text NOT NULL,
	`opening_cash` integer,
	`closing_cash_counted` integer,
	`closing_cash_expected` integer,
	`selisih` integer,
	`catatan` text,
	`bukti_foto_url` text,
	`status` text DEFAULT 'open' NOT NULL,
	`opened_at` integer NOT NULL,
	`closed_at` integer,
	`closed_by_user_id` text,
	`reopened_at` integer,
	`reopened_by_user_id` text,
	FOREIGN KEY (`kasir_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`closed_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`reopened_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `shift_kasir_kasir_status_idx` ON `shift_kasir` (`kasir_user_id`,`status`);
--> statement-breakpoint
CREATE INDEX `shift_kasir_status_idx` ON `shift_kasir` (`status`,`opened_at`);
--> statement-breakpoint
ALTER TABLE `transaksi` ADD `shift_id` integer;
--> statement-breakpoint
ALTER TABLE `order` ADD `shift_id` integer;
--> statement-breakpoint
ALTER TABLE `pengeluaran` ADD `shift_id` integer;
