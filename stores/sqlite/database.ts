import { type BunSQLiteDatabase, drizzle } from "drizzle-orm/bun-sqlite";
import { migrate as runMigration } from "drizzle-orm/bun-sqlite/migrator";
import type { Database as SQLiteDatabase } from "sqlite";

import { contexts } from "~stores/sqlite/contexts/schema.ts";
import { events } from "~stores/sqlite/events/schema.ts";
import { prepareMigrationFiles } from "~utilities/migrations.ts";

export const schema = { contexts, events };

/**
 * Takes a `npm:sqlite` database instance and migrates event store structure.
 *
 * @param connection - Connection to migrate against.
 * @param output     - Folder to place the migration files in.
 */
export async function migrate(connection: SQLiteDatabase, output: string): Promise<void> {
  await prepareMigrationFiles(import.meta, output);
  await runMigration(drizzle(connection, { schema }), {
    migrationsFolder: output,
    migrationsTable: "event_store_migrations",
  });
}

/*
 |--------------------------------------------------------------------------------
 | Types
 |--------------------------------------------------------------------------------
 */

export type EventStoreDB = BunSQLiteDatabase<{
  contexts: typeof contexts;
  events: typeof events;
}>;
