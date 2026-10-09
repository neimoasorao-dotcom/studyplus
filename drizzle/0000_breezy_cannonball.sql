CREATE TABLE `dashboard_chunks` (
	`revision` integer NOT NULL,
	`part` integer NOT NULL,
	`body` text NOT NULL,
	PRIMARY KEY(`revision`, `part`)
);
--> statement-breakpoint
CREATE TABLE `dashboard_state` (
	`id` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL
);
