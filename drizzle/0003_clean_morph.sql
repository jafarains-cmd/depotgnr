ALTER TABLE `order` ADD `tipe_pengantaran` text DEFAULT 'antar-saja' NOT NULL;--> statement-breakpoint
ALTER TABLE `order` ADD `bukti_jemput_url` text;--> statement-breakpoint
ALTER TABLE `order` ADD `dijemput_at` integer;--> statement-breakpoint
ALTER TABLE `order` ADD `diisi_at` integer;