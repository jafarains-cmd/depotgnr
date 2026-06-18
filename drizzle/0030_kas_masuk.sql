CREATE TABLE `kas_masuk` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tanggal` integer NOT NULL,
	`kategori` text NOT NULL,
	`jumlah` integer NOT NULL,
	`deskripsi` text,
	`created_by` text,
	`shift_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `kas_masuk_tanggal_idx` ON `kas_masuk` (`tanggal`);
--> statement-breakpoint
CREATE INDEX `kas_masuk_shift_idx` ON `kas_masuk` (`shift_id`);
