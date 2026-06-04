CREATE TABLE `galon_dipinjam` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pelanggan_id` integer NOT NULL,
	`produk_id` integer NOT NULL,
	`jumlah` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`pelanggan_id`) REFERENCES `pelanggan`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `mutasi_galon_pinjam` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pelanggan_id` integer NOT NULL,
	`produk_id` integer NOT NULL,
	`perubahan` integer NOT NULL,
	`tipe` text NOT NULL,
	`alasan` text,
	`ref_transaksi_id` integer,
	`ref_order_id` integer,
	`galon_serial` text,
	`user_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`pelanggan_id`) REFERENCES `pelanggan`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `galon_dipinjam_pelanggan_produk_idx` ON `galon_dipinjam` (`pelanggan_id`,`produk_id`);--> statement-breakpoint
CREATE INDEX `mutasi_galon_pinjam_pelanggan_date_idx` ON `mutasi_galon_pinjam` (`pelanggan_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `mutasi_galon_pinjam_ref_trx_idx` ON `mutasi_galon_pinjam` (`ref_transaksi_id`);--> statement-breakpoint
CREATE INDEX `mutasi_galon_pinjam_ref_order_idx` ON `mutasi_galon_pinjam` (`ref_order_id`);
