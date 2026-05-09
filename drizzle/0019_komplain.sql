CREATE TABLE `komplain` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pelanggan_id` integer NOT NULL,
	`ref_order_id` integer,
	`jenis` text NOT NULL,
	`deskripsi` text NOT NULL,
	`foto_url` text,
	`status` text DEFAULT 'baru' NOT NULL,
	`resolusi` text,
	`kompensasi_loyalti` integer DEFAULT 0 NOT NULL,
	`resolved_at` integer,
	`resolved_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`pelanggan_id`) REFERENCES `pelanggan`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resolved_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `komplain_status_idx` ON `komplain` (`status`);--> statement-breakpoint
CREATE INDEX `komplain_pelanggan_date_idx` ON `komplain` (`pelanggan_id`,`created_at`);
