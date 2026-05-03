ALTER TABLE `transaksi` ADD `voided_at` integer;--> statement-breakpoint
ALTER TABLE `transaksi` ADD `voided_by` text REFERENCES user(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `transaksi` ADD `voided_alasan` text;--> statement-breakpoint
CREATE INDEX `transaksi_voided_idx` ON `transaksi` (`voided_at`);
