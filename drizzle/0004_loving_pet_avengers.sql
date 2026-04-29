CREATE TABLE `mutasi_loyalti` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pelanggan_id` integer NOT NULL,
	`jumlah` integer NOT NULL,
	`tipe` text NOT NULL,
	`ref_order_id` integer,
	`ref_transaksi_id` integer,
	`deskripsi` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`pelanggan_id`) REFERENCES `pelanggan`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `pelanggan` ADD `saldo_loyalti` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `pelanggan` ADD `kode_referral` text;--> statement-breakpoint
ALTER TABLE `pelanggan` ADD `referred_by` integer;--> statement-breakpoint
ALTER TABLE `pelanggan` ADD `first_order_reward_claimed` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `pelanggan_kode_referral_unique` ON `pelanggan` (`kode_referral`);