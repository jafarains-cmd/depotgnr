CREATE TABLE `reminder_piutang` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`stage` integer NOT NULL,
	`channel` text DEFAULT 'wa-manual' NOT NULL,
	`sent_at` integer NOT NULL,
	`sent_by` text,
	`catatan` text,
	FOREIGN KEY (`order_id`) REFERENCES `order`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sent_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `reminder_piutang_order_idx` ON `reminder_piutang` (`order_id`);
--> statement-breakpoint
CREATE INDEX `reminder_piutang_stage_idx` ON `reminder_piutang` (`stage`, `sent_at`);
