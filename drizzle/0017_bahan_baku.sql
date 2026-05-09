CREATE TABLE `bahan_baku` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nama` text NOT NULL,
	`satuan` text DEFAULT 'pcs' NOT NULL,
	`stok` integer DEFAULT 0 NOT NULL,
	`threshold` integer DEFAULT 0 NOT NULL,
	`harga_satuan` integer DEFAULT 0 NOT NULL,
	`aktif` integer DEFAULT true NOT NULL,
	`catatan` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mutasi_bahan_baku` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bahan_id` integer NOT NULL,
	`perubahan` integer NOT NULL,
	`alasan` text NOT NULL,
	`biaya` integer DEFAULT 0 NOT NULL,
	`catatan` text,
	`user_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`bahan_id`) REFERENCES `bahan_baku`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `bahan_baku_aktif_idx` ON `bahan_baku` (`aktif`);--> statement-breakpoint
CREATE INDEX `mutasi_bahan_baku_bahan_date_idx` ON `mutasi_bahan_baku` (`bahan_id`,`created_at`);
