import type { MongoConnectionUrl } from "@valkyr/testcontainers/mongodb";
import { Db, MongoClient } from "mongodb";

import { EventStoreAdapter } from "../../types/adapter.ts";
import { registrars } from "./collections/mod.ts";
import { MongoEventsProvider } from "./providers/events.ts";
import { MongoRelationsProvider } from "./providers/relations.ts";
import { MongoSnapshotsProvider } from "./providers/snapshots.ts";
import { DatabaseAccessor } from "./types.ts";
import { getCollectionsSet } from "./utilities.ts";

/**
 * A server-based event store adapter that integrates database-specific providers.
 *
 * The `MongoAdapter` enables event sourcing in a back end environment by utilizing
 * MongoDB for storage. It provides implementations for event storage, relations,
 * and snapshots, allowing seamless integration with the shared event store interface.
 *
 * @template TEvent - The type of events managed by the event store.
 */
export class MongoAdapter implements EventStoreAdapter<DatabaseAccessor> {
  readonly providers: {
    readonly events: MongoEventsProvider;
    readonly relations: MongoRelationsProvider;
    readonly snapshots: MongoSnapshotsProvider;
  };

  readonly #accessor: DatabaseAccessor;

  constructor(connection: MongoConnection, db: string) {
    this.#accessor = getDatabaseAccessor(connection, db);
    this.providers = {
      events: new MongoEventsProvider(this.#accessor),
      relations: new MongoRelationsProvider(this.#accessor),
      snapshots: new MongoSnapshotsProvider(this.#accessor),
    };
  }

  get db(): DatabaseAccessor {
    return this.#accessor;
  }
}

/**
 * Takes a mongo database and registers the event store collections and
 * indexes defined internally.
 *
 * @param db     - Mongo database to register event store collections against.
 * @param logger - Logger method to print internal logs.
 */
export async function register(db: Db, logger?: (...args: any[]) => any) {
  const list = await getCollectionsSet(db);
  for (const { name, indexes } of registrars) {
    if (list.has(name)) {
      continue;
    }
    await db.createCollection(name);
    for (const [indexSpec, options] of indexes) {
      await db.collection(name).createIndex(indexSpec, options);
      logger?.("Mongo Event Store > Collection '%s' is indexed [%O] with options %O", name, indexSpec, options ?? {});
    }
    logger?.("Mongo Event Store > Collection '%s' is registered", name);
  }
}

function getDatabaseAccessor(connection: MongoConnection, database: string): DatabaseAccessor {
  let instance: Db | undefined;
  return {
    get db(): Db {
      if (instance === undefined) {
        instance = this.client.db(database);
      }
      return instance;
    },
    get client(): MongoClient {
      if (typeof connection === "string") {
        return new MongoClient(connection);
      }
      if (connection instanceof MongoClient) {
        return connection;
      }
      return connection();
    },
  };
}

/**
 * Connection which the adapter supports, this can be a `url`, a `client` instance
 * or a lazy method that provided `client` instance on demand.
 */
export type MongoConnection = MongoConnectionUrl | MongoClient | (() => MongoClient);
