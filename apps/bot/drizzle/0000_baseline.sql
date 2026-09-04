-- Baseline: the schema as it existed in production before 4.0.0 introduced
-- migrations. Hand-edited after generation to be idempotent (CREATE TABLE IF NOT
-- EXISTS, and the foreign key guarded against duplicate_object) so that running it
-- against the live database is a no-op rather than an error. Verified against a
-- schema-only dump of production: applying this to an empty database reproduces
-- every column, constraint, index and sequence exactly.
--
-- Only this file needs the idempotence treatment. Migrations generated from here on
-- run exactly once, in order, and must NOT be edited after they are committed.
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "automod_badfiles" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "automod_badfiles_id_seq" INCREMENT BY 1 MINVALUE 0 MAXVALUE 9223372036854775807 START WITH 0 CACHE 1 CYCLE),
	"type" varchar NOT NULL,
	"funcName" varchar NOT NULL,
	"test" varchar NOT NULL,
	"flagMessage" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "automod_rules" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "automod_rules_id_seq" INCREMENT BY 1 MINVALUE 0 MAXVALUE 9223372036854775807 START WITH 0 CACHE 1 CYCLE),
	"type" varchar NOT NULL,
	"filter" varchar NOT NULL,
	"added" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"reason" varchar DEFAULT 'Not provided' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "game_feeds" (
	"channel" varchar NOT NULL,
	"guild" varchar NOT NULL,
	"owner" varchar NOT NULL,
	"domain" varchar NOT NULL,
	"title" varchar NOT NULL,
	"nsfw" boolean DEFAULT false NOT NULL,
	"sfw" boolean DEFAULT true NOT NULL,
	"show_new" boolean DEFAULT true NOT NULL,
	"show_updates" boolean DEFAULT true NOT NULL,
	"webhook_id" varchar,
	"webhook_token" varchar,
	"message" varchar,
	"last_timestamp" timestamp with time zone NOT NULL,
	"created" timestamp with time zone NOT NULL,
	"_id" serial NOT NULL,
	"compact" boolean DEFAULT false NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"crosspost" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "news" (
	"title" varchar NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"id" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "server_role_conditions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "server_role_conditions_id_seq" INCREMENT BY 1 MINVALUE 0 MAXVALUE 9223372036854775807 START WITH 0 CACHE 1 CYCLE),
	"server_id" varchar NOT NULL,
	"role_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"game" varchar NOT NULL,
	"min" bigint DEFAULT 0,
	"op" varchar DEFAULT 'AND' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "servers" (
	"id" varchar NOT NULL,
	"official" boolean DEFAULT false NOT NULL,
	"channel_nexus" varchar,
	"role_author" varchar,
	"game_filter" varchar,
	"server_owner" varchar NOT NULL,
	"channel_news" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscribedchannels" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "subscribedchannels_id_seq" INCREMENT BY 1 MINVALUE 0 MAXVALUE 2147483647 START WITH 0 CACHE 1),
	"guild_id" varchar(255) NOT NULL,
	"channel_id" varchar(255) NOT NULL,
	"webhook_id" varchar(255) NOT NULL,
	"webhook_token" varchar(255) NOT NULL,
	"last_update" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"created" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscribeditems" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "subscribeditems_id_seq" INCREMENT BY 1 MINVALUE 0 MAXVALUE 2147483647 START WITH 0 CACHE 1),
	"parent" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"entityid" varchar(255) NOT NULL,
	"owner" varchar(255) NOT NULL,
	"last_update" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"created" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
	"crosspost" boolean,
	"compact" boolean,
	"message" text,
	"error_count" integer,
	"nsfw" boolean DEFAULT false,
	"sfw" boolean DEFAULT true,
	"type" varchar(50) NOT NULL,
	"show_new" boolean,
	"show_updates" boolean,
	"last_status" varchar,
	"config" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tips" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tips_id_seq" INCREMENT BY 1 MINVALUE 0 MAXVALUE 9223372036854775807 START WITH 0 CACHE 1),
	"prompt" varchar NOT NULL,
	"title" varchar NOT NULL,
	"embed" varchar,
	"message" varchar,
	"created" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"author" varchar NOT NULL,
	"approved" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_mods" (
	"domain" varchar NOT NULL,
	"mod_id" integer NOT NULL,
	"name" varchar,
	"game" varchar NOT NULL,
	"unique_downloads" integer DEFAULT 0 NOT NULL,
	"total_downloads" integer DEFAULT 0 NOT NULL,
	"path" varchar,
	"owner" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_servers" (
	"user_id" varchar NOT NULL,
	"server_id" varchar NOT NULL,
	CONSTRAINT "name and server" UNIQUE("user_id","server_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"d_id" varchar NOT NULL,
	"id" integer NOT NULL,
	"name" varchar NOT NULL,
	"avatar_url" varchar,
	"supporter" boolean DEFAULT false NOT NULL,
	"premium" boolean DEFAULT false NOT NULL,
	"lastupdate" timestamp with time zone NOT NULL,
	"modauthor" boolean DEFAULT false NOT NULL,
	"nexus_access" varchar,
	"nexus_refresh" varchar,
	"nexus_expires" bigint,
	"discord_access" varchar,
	"discord_refresh" varchar,
	"discord_expires" bigint,
	CONSTRAINT "Discord ID " UNIQUE("d_id"),
	CONSTRAINT "Nexus Mods ID" UNIQUE("id")
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "subscribeditems" ADD CONSTRAINT "fk_parent" FOREIGN KEY ("parent") REFERENCES "public"."subscribedchannels"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;