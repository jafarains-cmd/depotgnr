CREATE TABLE `lokasi_kurir` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`kurir_user_id` text NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`accuracy` real,
	`speed` real,
	`heading` real,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `order` ADD `tracking_token` text;