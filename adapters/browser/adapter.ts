import type { IndexedDatabase } from "@valkyr/db";

import { Event } from "../../libraries/event.ts";
import { EventStoreAdapter } from "../../types/adapter.ts";
import { Adapter, Collections, EventStoreDB, getEventStoreDatabase } from "./database.ts";
import { BrowserEventsProvider } from "./providers/events.ts";
import { BrowserRelationsProvider } from "./providers/relations.ts";
import { BrowserSnapshotsProvider } from "./providers/snapshots.ts";

/**
 * A browser-based event store adapter that integrates database-specific providers.
 *
 * The `BrowserAdapter` enables event sourcing in a browser environment by utilizing
 * IndexedDB for storage. It provides implementations for event storage, relations,
 * and snapshots, allowing seamless integration with the shared event store interface.
 *
 * @template TEvent - The type of events managed by the event store.
 */
export class BrowserAdapter<const TEvent extends Event> implements EventStoreAdapter<EventStoreDB> {
  readonly #database: IndexedDatabase<Collections>;

  providers: EventStoreAdapter<TEvent>["providers"];

  constructor(database: Adapter, name = "valkyr:event-store") {
    this.#database = getEventStoreDatabase(name, database) as IndexedDatabase<Collections>;
    this.providers = {
      events: new BrowserEventsProvider(this.#database.collection("events")),
      relations: new BrowserRelationsProvider(this.#database.collection("relations")),
      snapshots: new BrowserSnapshotsProvider(this.#database.collection("snapshots")),
    };
  }

  get db(): IndexedDatabase<Collections> {
    return this.#database;
  }
}
