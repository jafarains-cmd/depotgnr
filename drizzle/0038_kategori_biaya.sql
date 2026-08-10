CREATE TABLE `kategori_biaya` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`nama` text NOT NULL,
	`tipe` text NOT NULL,
	`umur_hari_default` integer,
	`harga_estimasi` integer,
	`urutan` integer DEFAULT 0 NOT NULL,
	`aktif` integer DEFAULT 1 NOT NULL,
	`is_system` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kategori_biaya_slug_uniq` ON `kategori_biaya` (`slug`);
--> statement-breakpoint
CREATE INDEX `kategori_biaya_tipe_idx` ON `kategori_biaya` (`tipe`);
--> statement-breakpoint
CREATE INDEX `kategori_biaya_aktif_idx` ON `kategori_biaya` (`aktif`);
--> statement-breakpoint
-- Seed default 26 kategori (4 COGS + 11 operasional + 11 sparepart)
INSERT INTO `kategori_biaya` (`slug`, `nama`, `tipe`, `umur_hari_default`, `harga_estimasi`, `urutan`, `aktif`, `is_system`, `created_at`, `updated_at`) VALUES
	('air-baku-pdam', 'Air baku / PDAM', 'cogs', NULL, NULL, 1, 1, 1, unixepoch(), unixepoch()),
	('listrik-produksi', 'Listrik produksi', 'cogs', NULL, NULL, 2, 1, 1, unixepoch(), unixepoch()),
	('sabun-cuci-galon', 'Sabun cuci galon', 'cogs', NULL, NULL, 3, 1, 1, unixepoch(), unixepoch()),
	('tutup-galon', 'Tutup galon', 'cogs', NULL, NULL, 4, 1, 1, unixepoch(), unixepoch()),
	('bensin', 'Bensin', 'operasional', NULL, NULL, 10, 1, 1, unixepoch(), unixepoch()),
	('ongkos-antar', 'Ongkos kurir / antar', 'operasional', NULL, NULL, 11, 1, 1, unixepoch(), unixepoch()),
	('tip-kurir', 'Tip kurir', 'operasional', NULL, NULL, 12, 1, 1, unixepoch(), unixepoch()),
	('gaji-kasir', 'Gaji kasir', 'operasional', NULL, NULL, 13, 1, 1, unixepoch(), unixepoch()),
	('sewa-tempat', 'Sewa tempat', 'operasional', NULL, NULL, 14, 1, 1, unixepoch(), unixepoch()),
	('listrik-kantor', 'Listrik kantor', 'operasional', NULL, NULL, 15, 1, 1, unixepoch(), unixepoch()),
	('air-kamar-mandi', 'Air kamar mandi', 'operasional', NULL, NULL, 16, 1, 1, unixepoch(), unixepoch()),
	('atk-print', 'ATK / print struk', 'operasional', NULL, NULL, 17, 1, 1, unixepoch(), unixepoch()),
	('internet-pulsa', 'Internet / pulsa', 'operasional', NULL, NULL, 18, 1, 1, unixepoch(), unixepoch()),
	('makan-kasir', 'Makan / minum kasir & kurir', 'operasional', NULL, NULL, 19, 1, 1, unixepoch(), unixepoch()),
	('beli-galon-eceran', 'Beli galon eceran cepat', 'operasional', NULL, NULL, 20, 1, 1, unixepoch(), unixepoch()),
	('pemeliharaan-lain', 'Pemeliharaan lain-lain', 'operasional', NULL, NULL, 21, 1, 1, unixepoch(), unixepoch()),
	('lainnya', 'Lain-lain', 'operasional', NULL, NULL, 99, 1, 1, unixepoch(), unixepoch()),
	('membran-ro', 'Membran RO', 'sparepart', 180, 300000, 50, 1, 1, unixepoch(), unixepoch()),
	('filter-carbon', 'Filter carbon', 'sparepart', 90, 50000, 51, 1, 1, unixepoch(), unixepoch()),
	('filter-sediment', 'Filter sediment', 'sparepart', 90, 25000, 52, 1, 1, unixepoch(), unixepoch()),
	('cartridge-mineral', 'Cartridge mineral', 'sparepart', 180, 75000, 53, 1, 1, unixepoch(), unixepoch()),
	('uv-lamp', 'UV lamp / sterilisator', 'sparepart', 365, 250000, 54, 1, 1, unixepoch(), unixepoch()),
	('mesin-bundur', 'Mesin bundur galon', 'sparepart', 1825, 2500000, 55, 1, 1, unixepoch(), unixepoch()),
	('kran-isi', 'Kran tempat isi', 'sparepart', 730, 100000, 56, 1, 1, unixepoch(), unixepoch()),
	('pompa-air', 'Pompa air', 'sparepart', 1825, 750000, 57, 1, 1, unixepoch(), unixepoch()),
	('tangki-penampung', 'Tangki penampung', 'sparepart', 3650, 1500000, 58, 1, 1, unixepoch(), unixepoch()),
	('housing-filter', 'Housing filter', 'sparepart', 1825, 150000, 59, 1, 1, unixepoch(), unixepoch());
