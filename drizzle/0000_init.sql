CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`id_token` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`impersonated_by` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`role` text DEFAULT 'pelanggan' NOT NULL,
	`alamat` text,
	`telegram_chat_id` text,
	`username` text,
	`display_username` text,
	`phone_number` text,
	`phone_number_verified` integer,
	`banned` integer,
	`ban_reason` text,
	`ban_expires` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_phone_number_unique` ON `user` (`phone_number`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `mutasi_stok` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`produk_id` integer NOT NULL,
	`status` text NOT NULL,
	`perubahan` integer NOT NULL,
	`alasan` text NOT NULL,
	`ref_transaksi_id` integer,
	`ref_order_id` integer,
	`user_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`produk_id`) REFERENCES `produk`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `stok_galon` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`produk_id` integer NOT NULL,
	`status` text NOT NULL,
	`jumlah` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`produk_id`) REFERENCES `produk`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `order` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nomor_order` text NOT NULL,
	`pelanggan_id` integer,
	`sumber` text DEFAULT 'web' NOT NULL,
	`alamat_antar` text,
	`jadwal_antar` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`kurir_user_id` text,
	`total_estimasi` integer DEFAULT 0 NOT NULL,
	`transaksi_id` integer,
	`catatan` text,
	`sheet_row_id` text,
	`last_synced_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`pelanggan_id`) REFERENCES `pelanggan`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`kurir_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`transaksi_id`) REFERENCES `transaksi`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `order_nomor_order_unique` ON `order` (`nomor_order`);--> statement-breakpoint
CREATE TABLE `order_item` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`produk_id` integer NOT NULL,
	`qty` integer NOT NULL,
	`jenis` text NOT NULL,
	`harga_estimasi` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `order`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`produk_id`) REFERENCES `produk`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `galon_pelanggan` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pelanggan_id` integer NOT NULL,
	`produk_id` integer NOT NULL,
	`jumlah_dititip` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`pelanggan_id`) REFERENCES `pelanggan`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `pelanggan` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text,
	`nama` text NOT NULL,
	`telp` text,
	`alamat` text,
	`koordinat_lat` real,
	`koordinat_lng` real,
	`tipe` text DEFAULT 'umum' NOT NULL,
	`catatan` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `chat_session` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`channel` text NOT NULL,
	`chat_id` text NOT NULL,
	`state` text DEFAULT 'idle' NOT NULL,
	`data` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pengaturan` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_conflict` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text NOT NULL,
	`db_version` text,
	`sheet_version` text,
	`resolved` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`processed_at` integer,
	`error` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `produk` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nama` text NOT NULL,
	`deskripsi` text,
	`harga_isi_ulang` integer DEFAULT 0 NOT NULL,
	`harga_tukar` integer DEFAULT 0 NOT NULL,
	`harga_beli_baru` integer DEFAULT 0 NOT NULL,
	`aktif` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transaksi` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nomor_nota` text NOT NULL,
	`kasir_user_id` text,
	`pelanggan_id` integer,
	`subtotal` integer DEFAULT 0 NOT NULL,
	`diskon` integer DEFAULT 0 NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`metode_bayar` text DEFAULT 'cash' NOT NULL,
	`status` text DEFAULT 'lunas' NOT NULL,
	`catatan` text,
	`ref_order_id` integer,
	`sheet_row_id` text,
	`last_synced_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`kasir_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`pelanggan_id`) REFERENCES `pelanggan`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transaksi_nomor_nota_unique` ON `transaksi` (`nomor_nota`);--> statement-breakpoint
CREATE TABLE `transaksi_item` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`transaksi_id` integer NOT NULL,
	`produk_id` integer NOT NULL,
	`qty` integer NOT NULL,
	`harga_satuan` integer NOT NULL,
	`subtotal` integer NOT NULL,
	`jenis` text NOT NULL,
	FOREIGN KEY (`transaksi_id`) REFERENCES `transaksi`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`produk_id`) REFERENCES `produk`(`id`) ON UPDATE no action ON DELETE no action
);
