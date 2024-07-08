import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate as runMigration } from "drizzle-orm/postgres-js/migrator";
import type { Sql } from "postgres";

import { Database } from "~utilities/database.ts";
import { prepareMigrationFiles } from "../../utilities/migrations.ts";

import { contexts } from "./contexts/schema.ts";
import { events } from "./events/schema.ts";

const schema = { contexts, events };

/**
 * Takes a `npm:postgres` database instance and returns a event store database.
 *
 * @param connection - SQLite connection to use for the database.
 */
export function makeEventStoreDatabase(connection: Sql) {
  return new Database<EventStoreDB>(drizzle(connection, { schema }), {
    async onCloseInstance() {
      await connection.end();
    },
  });
}

/**
 * Takes a `npm:postgres` database instance and migrates event store structure.
 *
 * @param connection - Connection to migrate against.
 * @param output     - Folder to place the migration files in.
 */
export async function migrate(connection: Sql, output: string): Promise<void> {
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

export type EventStoreDB = PostgresJsDatabase<{
  contexts: typeof contexts;
  events: typeof events;
}>;
