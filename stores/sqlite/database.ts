import { resolve } from "node:path";

import { type BunSQLiteDatabase, drizzle } from "drizzle-orm/bun-sqlite";
import { migrate as runMigration } from "drizzle-orm/bun-sqlite/migrator";
import type { Database as SQLiteDatabase } from "sqlite";

import { Database } from "~utilities/database.ts";

import { contexts } from "./contexts/schema.ts";
import { events } from "./events/schema.ts";

const dirname = import.meta.dirname ?? __dirname;
const schema = { contexts, events };

/**
 * Takes a `npm:sqlite` database instance and returns a event store database.
 *
 * @param connection - SQLite connection to use for the database.
 */
export function makeEventStoreDatabase(connection: SQLiteDatabase) {
  return new Database<EventStoreDB>(drizzle(connection, { schema }), {
    async onCloseInstance() {
      connection.close();
    },
  });
}

/**
 * Takes a `npm:sqlite` database instance and migrates event store structure.
 *
 * @param connection - Connection to migrate against.
 */
export async function migrate(connection: SQLiteDatabase): Promise<void> {
  await runMigration(drizzle(connection, { schema }), {
    migrationsFolder: resolve(dirname, "migrations"),
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
