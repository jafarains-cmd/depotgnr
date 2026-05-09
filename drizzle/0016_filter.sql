CREATE TABLE `filter` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nama` text NOT NULL,
	`kategori` text NOT NULL,
	`interval_hari` integer NOT NULL,
	`ganti_terakhir` integer,
	`catatan` text,
	`aktif` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `filter_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`filter_id` integer NOT NULL,
	`ganti_at` integer NOT NULL,
	`ganti_by` text,
	`biaya` integer DEFAULT 0 NOT NULL,
	`catatan` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`filter_id`) REFERENCES `filter`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ganti_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `filter_aktif_idx` ON `filter` (`aktif`);--> statement-breakpoint
CREATE INDEX `filter_log_filter_idx` ON `filter_log` (`filter_id`,`ganti_at`);
