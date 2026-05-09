CREATE TABLE `pengeluaran` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tanggal` integer NOT NULL,
	`kategori` text NOT NULL,
	`jumlah` integer NOT NULL,
	`deskripsi` text,
	`foto_nota_url` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `pengeluaran_tanggal_idx` ON `pengeluaran` (`tanggal`);--> statement-breakpoint
CREATE INDEX `pengeluaran_kategori_idx` ON `pengeluaran` (`kategori`);
