import { EventStoreAdapter } from "../../types/adapter.ts";
import { PostgresConnection } from "./connection.ts";
import { PostgresDatabase } from "./database.ts";
import { PostgresEventsProvider } from "./providers/event.ts";
import { PostgresRelationsProvider } from "./providers/relations.ts";
import { PostgresSnapshotsProvider } from "./providers/snapshot.ts";

/**
 * A server-based event store adapter that integrates database-specific providers.
 *
 * The `PostgresAdapter` enables event sourcing in a back end environment by utilizing
 * PostgreSql for storage. It provides implementations for event storage, relations,
 * and snapshots, allowing seamless integration with the shared event store interface.
 *
 * @template TEvent - The type of events managed by the event store.
 */
export class PostgresAdapter implements EventStoreAdapter<PostgresDatabase> {
  readonly providers: {
    readonly events: PostgresEventsProvider;
    readonly relations: PostgresRelationsProvider;
    readonly snapshots: PostgresSnapshotsProvider;
  };

  #database: PostgresDatabase;

  constructor(
    readonly connection: PostgresConnection,
    readonly options: Options = {},
  ) {
    this.#database = new PostgresDatabase(connection);
    this.providers = {
      events: new PostgresEventsProvider(this.#database, options.schema),
      relations: new PostgresRelationsProvider(this.#database, options.schema),
      snapshots: new PostgresSnapshotsProvider(this.#database, options.schema),
    };
  }

  get db(): PostgresDatabase {
    return this.#database;
  }
}

type Options = {
  schema?: string;
};
