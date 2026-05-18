CREATE TABLE `nota_gabungan` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kode` text NOT NULL,
	`pelanggan_id` integer NOT NULL,
	`total_estimasi` integer DEFAULT 0 NOT NULL,
	`total_galon` integer DEFAULT 0 NOT NULL,
	`jumlah_order` integer DEFAULT 0 NOT NULL,
	`dibuat_oleh` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`pelanggan_id`) REFERENCES `pelanggan`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`dibuat_oleh`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nota_gabungan_kode_unique` ON `nota_gabungan` (`kode`);--> statement-breakpoint
CREATE INDEX `nota_gabungan_pelanggan_idx` ON `nota_gabungan` (`pelanggan_id`);--> statement-breakpoint
ALTER TABLE `order` ADD `nota_gabungan_id` integer REFERENCES `nota_gabungan`(`id`) ON UPDATE no action ON DELETE set null;--> statement-breakpoint
CREATE INDEX `order_nota_gabungan_idx` ON `order` (`nota_gabungan_id`,`status_bayar`);
