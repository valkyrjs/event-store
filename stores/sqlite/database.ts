import { resolve } from "node:path";

import { type BunSQLiteDatabase, drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import type { Database as SQLiteDatabase } from "sqlite";

import { Database } from "~utilities/database.ts";

import { contexts } from "./contexts/schema.ts";
import { events } from "./events/schema.ts";

/**
 * Takes a `npm:sqlite` database instance and returns a event store database.
 *
 * @param connection - SQLite connection to use for the database.
 */
export function makeEventStoreDatabase(connection: SQLiteDatabase) {
  return new Database<EventStoreDB>(drizzle(connection, { schema: { contexts, events } }), {
    async onMigrateInstance(context) {
      await migrate(context, { migrationsFolder: resolve(import.meta.dirname ?? "./", "migrations") });
    },
    async onCloseInstance() {
      connection.close();
    },
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
