-- Tambah FK opsional ke master kategori_biaya di 3 tabel biaya.
-- Kolom string lama (pengeluaran.kategori, filter.kategori) tetap ada untuk
-- backward-compat dengan data existing.

ALTER TABLE `pengeluaran` ADD `kategori_biaya_id` integer REFERENCES `kategori_biaya`(`id`) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE `filter` ADD `kategori_biaya_id` integer REFERENCES `kategori_biaya`(`id`) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE `filter` ADD `harga_beli` integer;
--> statement-breakpoint
ALTER TABLE `filter` ADD `tanggal_pasang` integer;
--> statement-breakpoint
ALTER TABLE `bahan_baku` ADD `kategori_biaya_id` integer REFERENCES `kategori_biaya`(`id`) ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX `pengeluaran_kategori_biaya_idx` ON `pengeluaran` (`kategori_biaya_id`);
--> statement-breakpoint
CREATE INDEX `filter_kategori_biaya_idx` ON `filter` (`kategori_biaya_id`);
--> statement-breakpoint
CREATE INDEX `bahan_baku_kategori_biaya_idx` ON `bahan_baku` (`kategori_biaya_id`);
