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
	"recorded" varchar NOT NULL,
	"created" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_store"."snapshots" (
	"name" varchar NOT NULL,
	"stream" varchar NOT NULL,
	"cursor" varchar NOT NULL,
	"state" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contexts_key_index" ON "event_store"."contexts" USING btree ("key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_stream_index" ON "event_store"."events" USING btree ("stream");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_type_index" ON "event_store"."events" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_recorded_index" ON "event_store"."events" USING btree ("recorded");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_created_index" ON "event_store"."events" USING btree ("created");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "snapshots_name_stream_cursor_index" ON "event_store"."snapshots" USING btree ("name","stream","cursor");