CREATE TABLE `supplier` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nama` text NOT NULL,
	`telp` text,
	`alamat` text,
	`catatan` text,
	`aktif` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `supplier_aktif_idx` ON `supplier` (`aktif`);
--> statement-breakpoint
CREATE TABLE `pembelian_galon` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tanggal` integer NOT NULL,
	`produk_id` integer NOT NULL,
	`supplier_id` integer,
	`jenis` text NOT NULL,
	`jumlah` integer NOT NULL,
	`harga_satuan` integer NOT NULL,
	`total_harga` integer NOT NULL,
	`no_invoice` text,
	`foto_nota_url` text,
	`catatan` text,
	`ref_pengeluaran_id` integer,
	`created_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`produk_id`) REFERENCES `produk`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`supplier_id`) REFERENCES `supplier`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `pembelian_galon_tanggal_idx` ON `pembelian_galon` (`tanggal`);
--> statement-breakpoint
CREATE INDEX `pembelian_galon_produk_idx` ON `pembelian_galon` (`produk_id`);
--> statement-breakpoint
CREATE INDEX `pembelian_galon_supplier_idx` ON `pembelian_galon` (`supplier_id`);
--> statement-breakpoint
ALTER TABLE `produk` ADD `harga_pokok` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `produk` ADD `brand` text;
