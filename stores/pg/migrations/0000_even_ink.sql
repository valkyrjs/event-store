CREATE SCHEMA "event_store";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_store"."contexts" (
	"key" varchar NOT NULL,
	"stream" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_store"."events" (
	"id" varchar PRIMARY KEY NOT NULL,
	"stream" varchar NOT NULL,
	"type" varchar NOT NULL,
	"data" jsonb NOT NULL,
	"meta" jsonb NOT NULL,
	"recorded" bigint NOT NULL,
	"created" bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "key_idx" ON "event_store"."contexts" USING btree ("key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stream_idx" ON "event_store"."events" USING btree ("stream");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "type_idx" ON "event_store"."events" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recorded_idx" ON "event_store"."events" USING btree ("recorded");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "created_idx" ON "event_store"."events" USING btree ("created");