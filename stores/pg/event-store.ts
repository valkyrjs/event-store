/**
 * @module
 *
 * This module contains an event store solution for postgres.
 *
 * @example
 * ```ts
 * import psql from "postgres";
 *
 * import { PGEventStore } from "@valkyr/event-store/pg";
 * import { z } from "@valkyr/event-store";
 *
 * const eventStore = new PGEventStore<MyEvents>({
 *   database: psql("postgres/connection/string"),
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

import type { Sql as PGDatabase } from "postgres";
import type { AnyZodObject } from "zod";

import { Validator } from "~libraries/validator.ts";
import { Projector } from "~libraries/projector.ts";
import { createEventRecord } from "~libraries/event.ts";
import { makeReducer } from "~libraries/reducer.ts";
import { Contextor } from "~libraries/contextor.ts";
import {
  EventContextFailure,
  EventDataValidationFailure,
  EventInsertionFailure,
  EventProjectionFailure,
  EventPushSuccess,
  EventValidationFailure,
} from "~libraries/store.ts";
import type { Empty, Unknown } from "~types/common.ts";
import type { Event, EventRecord, EventStatus, EventToRecord } from "~types/event.ts";
import type { ReduceHandler, Reducer } from "~types/reducer.ts";
import type { EventReadOptions, Pagination, PushResult } from "~types/event-store.ts";
import type { Database } from "~utilities/database.ts";

import { ContextProvider } from "./contexts/provider.ts";
import { EventProvider } from "./events/provider.ts";
import { type EventStoreDB, makeEventStoreDatabase } from "./database.ts";

/*
 |--------------------------------------------------------------------------------
 | Event Store
 |--------------------------------------------------------------------------------
 */

/**
 * Provides a solution to easily validate, generate, and project events to a
 * postgres database.
 */
export class PGEventStore<TEvent extends Event, TRecord extends EventRecord = EventToRecord<TEvent>> {
  readonly #database: Database<EventStoreDB>;
  readonly #events: EventList<TEvent>;
  readonly #validators: Map<TEvent["type"], AnyZodObject>;

  readonly contexts: ContextProvider;
  readonly events: EventProvider;

  readonly validator: Validator<TRecord>;
  readonly projector: Projector<TRecord>;
  readonly contextor: Contextor<TRecord>;

  constructor(config: Config<TEvent>) {
    this.#database = makeEventStoreDatabase(config.database);
    this.#events = config.events;
    this.#validators = config.validators;

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

  /**
   * Access the event store database migration method.
   */
  get migrate(): () => Promise<void> {
    return this.#database.migrate;
  }

  /*
   |--------------------------------------------------------------------------------
   | Factories
   |--------------------------------------------------------------------------------
   */

  /**
   * Make a new event reducer based on the events registered with the event store.
   *
   * @param reducer - Reducer method to run over given events.
   * @param state   - Initial state.
   *
   * @example
   *
   * ```ts
   * const getFooState = eventStore.reducer<{ name: string }>((event, state) => {
   *   switch (event.type) {
   *     case "FooCreated": {
   *       state.name = event.data.name;
   *       return state;
   *     }
   *   }
   *   return state;
   * }, {
   *   name: ""
   * });
   *
   * // ### Solution 1
   *
   * const events = await eventStore.getEventsByStream("xyz");
   * const foo = getFooState(events);
   *
   * // ### Solution 2
   *
   * const foo = await eventStore.getStreamState("xyz", getFooState);
   * ```
   */
  reducer<TState extends Unknown>(reducer: Reducer<TState, TRecord>, state: TState): ReduceHandler<TState, TRecord> {
    return makeReducer<TState, TRecord>(reducer, state);
  }

  /*
   |--------------------------------------------------------------------------------
   | Writers
   |--------------------------------------------------------------------------------
   */

  /**
   * Push a new event onto the local event store database.
   *
   * @remarks Push is meant to take events from the local services and insert them as new event
   * records as non hydrated events.
   *
   * @param stream - Stream the event belongs to.
   * @param event  - Event data to record.
   */
  async add<TEventType extends Event["type"]>(
    event: ExcludeEmptyFields<Extract<TEvent, { type: TEventType }>> & {
      stream?: string;
    },
  ): Promise<PushResult> {
    return this.push(createEventRecord(event as any) as TRecord, false);
  }

  /**
   * Insert a new event to the local event store database.
   *
   * @remarks This method triggers event validation and projection. If validation fails the event will
   * not be inserted. If the projection fails the projection itself should be handling the error based
   * on its own business logic.
   *
   * @remarks When hydration is true the event will be recorded with a new locally generated timestamp
   * as its being recorded locally but is not the originator of the event creation.
   *
   * @param record   - EventRecord to insert.
   * @param hydrated - Whether the event is hydrated or not. (Optional)
   */
  async push(record: TRecord, hydrated = true): Promise<PushResult> {
    if (this.#events.has(record.type) === false) {
      throw new Error(`Event '${record.type}' is not registered with the event store!`);
    }

    const status = await this.getEventStatus(record);
    if (status.exists === true) {
      return new EventPushSuccess(record);
    }

    if (hydrated === true) {
      record.recorded = Date.now();
    }

    try {
      const result = await this.getValidator(record.type).safeParseAsync(record.data);
      if (result.success === false) {
        return new EventDataValidationFailure(result.error.flatten().fieldErrors);
      }
      await this.validator.validate(record);
    } catch (error) {
      return new EventValidationFailure(error.message);
    }

    try {
      await this.events.insert(record);
    } catch (error) {
      return new EventInsertionFailure(error.message);
    }

    try {
      await this.contextor.push(record);
    } catch (error) {
      return new EventContextFailure(error.message);
    }

    try {
      await this.projector.project(record, { hydrated, outdated: status.outdated });
    } catch (error) {
      return new EventProjectionFailure(error.message);
    }

    return new EventPushSuccess(record);
  }

  /*
   |--------------------------------------------------------------------------------
   | Readers
   |--------------------------------------------------------------------------------
   */

  /**
   * Enable the ability to check an incoming events status in relation to the local
   * ledger. This is to determine what actions to take upon the ledger based on the
   * current status.
   *
   * **Exists**
   *
   * References the existence of the event in the local ledger. It is determined by
   * looking at the recorded event id which should be unique to the entirety of the
   * ledger.
   *
   * **Outdated**
   *
   * References the events created relationship to the same event type in the
   * hosted stream. If another event of the same type in the streamis newer than
   * the provided event, the provided event is considered outdated.
   */
  async getEventStatus(event: TRecord): Promise<EventStatus> {
    const record = await this.events.getById(event.id);
    if (record) {
      return { exists: true, outdated: true };
    }
    return { exists: false, outdated: await this.events.checkOutdated(event) };
  }

  /**
   * Retrieve events from the events table.
   *
   * @param options - Read options. (Optional)
   */
  async getEvents(options?: EventReadOptions): Promise<TRecord[]> {
    return (await this.events.find(options)) as TRecord[];
  }

  /**
   * An event reducer aims to create an aggregate state that is as close to up to
   * date as possible. This is handy when we want to performthings such as business
   * logic on the command/action layer of the event creation lifecycle.
   *
   * By default the state is as close as possible since we are operating in a
   * distributed system without a central authority or sequential event bus. As such
   * developers is advised to build with failure at a later date as an option.
   *
   * This method operates by pulling all the latest known events of an event stream
   * and reduces them into a single current state representing of the event stream.
   */
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

  /**
   * Retrieve events from the events table under the given stream.
   *
   * @param stream  - Stream to retrieve events for.
   * @param options - Stream logic options. _(Optional)_
   */
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

type Config<TEvent extends Event> = {
  database: PGDatabase;
  events: EventList<TEvent>;
  validators: Map<TEvent["type"], AnyZodObject>;
};

type EventList<E extends Event> = Set<E["type"]>;

type ExcludeEmptyFields<T> = {
  [K in keyof T as T[K] extends Empty ? never : K]: T[K];
};
