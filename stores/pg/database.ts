import { resolve } from "node:path";

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { Sql } from "postgres";

import { Database } from "~utilities/database.ts";

import { contexts } from "./contexts/schema.ts";
import { events } from "./events/schema.ts";

/**
 * Takes a `npm:sqlite` database instance and returns a event store database.
 *
 * @param connection - SQLite connection to use for the database.
 */
export function makeEventStoreDatabase(connection: Sql) {
  return new Database<EventStoreDB>(drizzle(connection, { schema: { contexts, events } }), {
    async onMigrateInstance(context) {
      await migrate(context, { migrationsFolder: resolve(import.meta.dirname ?? "./", "migrations") });
    },
    async onCloseInstance() {
      await connection.end();
    },
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
