CREATE TABLE `mutasi_titipan` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pelanggan_id` integer NOT NULL,
	`produk_id` integer NOT NULL,
	`perubahan` integer NOT NULL,
	`alasan` text NOT NULL,
	`ref_order_id` integer,
	`catatan` text,
	`user_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`pelanggan_id`) REFERENCES `pelanggan`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `galon_pelanggan_pelanggan_produk_idx` ON `galon_pelanggan` (`pelanggan_id`,`produk_id`);--> statement-breakpoint
CREATE INDEX `mutasi_titipan_pelanggan_date_idx` ON `mutasi_titipan` (`pelanggan_id`,`created_at`);
