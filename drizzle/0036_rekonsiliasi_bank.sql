CREATE TABLE `rekonsiliasi_bank` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tanggal` integer NOT NULL,
	`metode` text NOT NULL,
	`omzet_sistem` integer NOT NULL,
	`saldo_aktual` integer NOT NULL,
	`selisih` integer NOT NULL,
	`catatan` text,
	`verified_by` text,
	`verified_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`verified_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `rekonsiliasi_tanggal_idx` ON `rekonsiliasi_bank` (`tanggal`);
--> statement-breakpoint
CREATE UNIQUE INDEX `rekonsiliasi_tanggal_metode_uniq` ON `rekonsiliasi_bank` (`tanggal`,`metode`);
