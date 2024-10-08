CREATE TABLE IF NOT EXISTS "discord_members" (
	"discord_id" varchar(18) PRIMARY KEY NOT NULL,
	"birthday" date,
	"has_birth_year" boolean NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "discord_id_idx" ON "discord_members" ("discord_id");