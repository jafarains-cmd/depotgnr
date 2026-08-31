-- Extend pelanggan untuk workflow verifikasi langganan (peminjaman galon depot)
-- Backward compat: tipe enum lama 'umum'|'langganan' extend jadi
-- 'umum'|'langganan_pending'|'langganan'|'langganan_ditolak'. Row existing
-- dengan tipe='langganan' tetap valid — anggap sudah-verified.
ALTER TABLE `pelanggan` ADD COLUMN `ktp_foto_url` text;
--> statement-breakpoint
ALTER TABLE `pelanggan` ADD COLUMN `ktp_uploaded_at` integer;
--> statement-breakpoint
ALTER TABLE `pelanggan` ADD COLUMN `ktp_verified_at` integer;
--> statement-breakpoint
ALTER TABLE `pelanggan` ADD COLUMN `ktp_verified_by` text REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null;
--> statement-breakpoint
ALTER TABLE `pelanggan` ADD COLUMN `ktp_ditolak_alasan` text;
--> statement-breakpoint
ALTER TABLE `pelanggan` ADD COLUMN `limit_galon` integer;
--> statement-breakpoint
CREATE INDEX `pelanggan_tipe_idx` ON `pelanggan` (`tipe`);
