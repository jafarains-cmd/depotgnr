ALTER TABLE `shift_kasir` ADD `handover_amount` integer;
--> statement-breakpoint
ALTER TABLE `shift_kasir` ADD `handover_to_kasir_user_id` text REFERENCES `user`(`id`) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE `shift_kasir` ADD `handover_foto_url` text;
--> statement-breakpoint
ALTER TABLE `shift_kasir` ADD `handover_catatan` text;
--> statement-breakpoint
ALTER TABLE `shift_kasir` ADD `opening_from_shift_id` integer;
--> statement-breakpoint
ALTER TABLE `shift_kasir` ADD `opening_extra_amount` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `shift_kasir` ADD `opening_extra_source` text;
--> statement-breakpoint
ALTER TABLE `shift_kasir` ADD `opening_extra_catatan` text;
