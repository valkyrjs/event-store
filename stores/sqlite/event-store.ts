/**
 * @module
 *
 * This module contains an event store solution for postgres.
 *
 * @example
 * ```ts
 * import { Database } from "sqlite";
 *
 * import { SQLiteEventStore } from "@valkyr/event-store/sqlite";
 * import { z } from "@valkyr/event-store";
 *
 * const eventStore = new SQLiteEventStore<MyEvents>({
 *   database: new Database(":memory:"),
 *   events: Set<[
 *     "EventA",
 *     "EventB"
 *   ] as const>,
 *   validators: new Map<MyEvents["type"], any>([
 *     ["EventA", z.object({ foo: z.string() }).strict()],
 *     ["EventB", z.object({ bar: z.string() }).strict()],
 *   ]),
 * });
 *
 * type MyEvents = EventA | EventB;
 *
 * type EventA = Event<"EventA", { foo: string }, { domain: string }>;
 * type EventB = Event<"EventB", { bar: string }, { domain: string }>;
 * ```
 */

import type { Database as SQLiteDatabase } from "sqlite";
import type { AnyZodObject } from "zod";

import { Contextor } from "~libraries/contextor.ts";
import { createEventRecord } from "~libraries/event.ts";
import { Projector } from "~libraries/projector.ts";
import { makeReducer } from "~libraries/reducer.ts";
import { Validator } from "~libraries/validator.ts";
import type { Unknown } from "~types/common.ts";
import type { Event, EventRecord, EventStatus, EventToRecord } from "~types/event.ts";
import type { EventHooks, EventReadOptions, EventStore, Pagination } from "~types/event-store.ts";
import type { ReduceHandler, Reducer } from "~types/reducer.ts";
import type { ExcludeEmptyFields } from "~types/utilities.ts";
import type { Database } from "~utilities/database.ts";

import { pushEventRecord, pushEventRecordSequence } from "../utilities.ts";
import { ContextProvider } from "./contexts/provider.ts";
import { type EventStoreDB, makeEventStoreDatabase } from "./database.ts";
import { EventProvider } from "./events/provider.ts";

export { migrate } from "./database.ts";

/*
 |--------------------------------------------------------------------------------
 | Event Store
 |--------------------------------------------------------------------------------
 */

/**
 * Provides a solution to easily validate, generate, and project events to a
 * sqlite database.
 */
export class SQLiteEventStore<TEvent extends Event, TRecord extends EventRecord = EventToRecord<TEvent>>
  implements EventStore<TEvent, TRecord> {
  readonly #database: Database<EventStoreDB>;
  readonly #events: EventList<TEvent>;
  readonly #validators: Map<TEvent["type"], AnyZodObject>;

  readonly hooks: EventHooks<TRecord>;

  readonly contexts: ContextProvider;
  readonly events: EventProvider;

  readonly validator: Validator<TRecord>;
  readonly projector: Projector<TRecord>;
  readonly contextor: Contextor<TRecord>;

  constructor(config: Config<TEvent, TRecord>) {
    this.#database = makeEventStoreDatabase(config.database);
    this.#events = config.events;
    this.#validators = config.validators;

    this.hooks = config.hooks ?? {};

    this.contexts = new ContextProvider(this.#database.instance);
    this.events = new EventProvider(this.#database.instance);

    this.validator = new Validator<TRecord>();
    this.projector = new Projector<TRecord>();
    this.contextor = new Contextor<TRecord>(this.contexts.handle.bind(this.contexts));
  }

  /*
   |--------------------------------------------------------------------------------
   | Accessors
   |--------------------------------------------------------------------------------
   */

  /**
   * Access the event store database instance.
   */
  get db(): EventStoreDB {
    return this.#database.instance;
  }

  has(type: TRecord["type"]): boolean {
    return this.#events.has(type);
  }

  /*
   |--------------------------------------------------------------------------------
   | Factories
   |--------------------------------------------------------------------------------
   */

  reducer<State extends Unknown>(reducer: Reducer<State, TRecord>, state: State): ReduceHandler<State, TRecord> {
    return makeReducer<State, TRecord>(reducer, state);
  }

  /*
   |--------------------------------------------------------------------------------
   | Writers
   |--------------------------------------------------------------------------------
   */

  async add<TEventType extends Event["type"]>(
    event: ExcludeEmptyFields<Extract<TEvent, { type: TEventType }>> & {
      stream?: string;
    },
  ): Promise<string> {
    return this.push(createEventRecord(event as any) as TRecord, false);
  }

  async addSequence<TEventType extends Event["type"]>(
    events: (ExcludeEmptyFields<Extract<TEvent, { type: TEventType }>> & { stream?: string })[],
  ): Promise<void> {
    return this.pushSequence(
      events.map((event) => ({ record: createEventRecord(event as any) as TRecord, hydrated: false })),
    );
  }

  async push(record: TRecord, hydrated = true): Promise<string> {
    return pushEventRecord(this as any, record, hydrated);
  }

  async pushSequence(records: { record: TRecord; hydrated?: boolean }[]): Promise<void> {
    return pushEventRecordSequence(
      this as any,
      records.map<{ record: TRecord; hydrated: boolean }>((record) => {
        record.hydrated = record.hydrated === undefined ? true : record.hydrated;
        return record as { record: TRecord; hydrated: boolean };
      }),
    );
  }

  /*
   |--------------------------------------------------------------------------------
   | Readers
   |--------------------------------------------------------------------------------
   */

  async getEventStatus(event: TRecord): Promise<EventStatus> {
    const record = await this.events.getById(event.id);
    if (record) {
      return { exists: true, outdated: true };
    }
    return { exists: false, outdated: await this.events.checkOutdated(event) };
  }

  async getEvents(options?: EventReadOptions): Promise<TRecord[]> {
    return (await this.events.find(options)) as TRecord[];
  }

  async getStreamState<TReducer extends ReduceHandler>(
    stream: string,
    reduce: TReducer,
  ): Promise<ReturnType<TReducer> | undefined> {
    const events = await this.getEventsByStream(stream);
    if (events.length === 0) {
      return undefined;
    }
    return reduce(events);
  }

  async getEventsByStream(stream: string, options?: EventReadOptions): Promise<TRecord[]> {
    return (await this.events.getByStream(stream, options)) as TRecord[];
  }

  /**
   * Retrieve all events under the given context key.
   *
   * @param key - Context key to retrieve events for.
   */
  async getEventsByContext(key: string, _?: Pagination): Promise<TRecord[]> {
    const rows = await this.contexts.getByKey(key);
    if (rows.length === 0) {
      return [];
    }
    return (await this.events.getByStreams(rows.map((row) => row.stream))) as TRecord[];
  }

  /*
   |--------------------------------------------------------------------------------
   | Utilities
   |--------------------------------------------------------------------------------
   */

  /**
   * Get a zod event validator instance used to check if an event object matches
   * the expected definitions.
   *
   * @param type - Event to get validator for.
   */
  getValidator(type: TRecord["type"]): AnyZodObject {
    return this.#validators.get(type)!;
  }
}

/*
 |--------------------------------------------------------------------------------
 | Types
 |--------------------------------------------------------------------------------
 */

type Config<TEvent extends Event, TRecord extends EventRecord> = {
  database: SQLiteDatabase;
  events: EventList<TEvent>;
  validators: Map<TEvent["type"], AnyZodObject>;
  hooks?: EventHooks<TRecord>;
};

type EventList<E extends Event> = Set<E["type"]>;
