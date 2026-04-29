ALTER TABLE `order` ADD `metode_bayar` text;--> statement-breakpoint
ALTER TABLE `order` ADD `status_bayar` text DEFAULT 'belum' NOT NULL;--> statement-breakpoint
ALTER TABLE `order` ADD `bukti_bayar_url` text;--> statement-breakpoint
ALTER TABLE `order` ADD `bayar_at` integer;