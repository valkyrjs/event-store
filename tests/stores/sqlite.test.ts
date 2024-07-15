import { resolve } from "node:path";

import { Database } from "sqlite";
import { afterAll, describe } from "std/testing/bdd.ts";

import { migrate, SQLiteEventStore } from "~stores/sqlite/event-store.ts";
import type { EventHooks } from "~types/event-store.ts";

import { testEventStoreMethods } from "./helpers/event-store.bdd.ts";
import { events, type UserEvent, type UserEventRecord, validators } from "./mocks/events.ts";

const DB_MIGRATE = resolve(import.meta.dirname!, "sqlite-migrate");

/*
 |--------------------------------------------------------------------------------
 | Database
 |--------------------------------------------------------------------------------
 */

afterAll(async () => {
  await Deno.remove(DB_MIGRATE, { recursive: true });
});

/*
 |--------------------------------------------------------------------------------
 | Tests
 |--------------------------------------------------------------------------------
 */

describe("SQLiteEventStore", () => {
  testEventStoreMethods(async (hooks?: EventHooks<UserEventRecord>) => getEventStore(hooks));
});

/*
 |--------------------------------------------------------------------------------
 | Utilities
 |--------------------------------------------------------------------------------
 */

async function getEventStore(hooks?: EventHooks<UserEventRecord>) {
  const database = new Database(":memory:");
  const store = new SQLiteEventStore<UserEvent>({
    database,
    events,
    validators,
    hooks,
  });
  await migrate(database, DB_MIGRATE);
  return store;
}
