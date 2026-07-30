CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`callsign` text NOT NULL,
	`display_name` text NOT NULL,
	`email` text,
	`password_hash` text,
	`role` text DEFAULT 'user' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`avatar_path` text,
	`metadata` text DEFAULT '{}' NOT NULL,
	`locale` text DEFAULT 'en' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_seen_at` text,
	CONSTRAINT "chk_role" CHECK(role IN ('admin', 'operator', 'user', 'readonly')),
	CONSTRAINT "chk_status" CHECK(status IN ('active', 'suspended', 'pending')),
	CONSTRAINT "chk_locale" CHECK(locale IN ('en', 'es', 'pt-BR'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_callsign_unique` ON `users` (`callsign`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_users_callsign` ON `users` (`callsign`);--> statement-breakpoint
CREATE INDEX `idx_users_role` ON `users` (`role`);--> statement-breakpoint
CREATE INDEX `idx_users_status` ON `users` (`status`);