/**
 * @module
 *
 * This module contains an event store solution for postgres.
 *
 * @example
 * ```ts
 * import { Database } from "sqlite";
 *
 * import { ValkyrEventStore } from "@valkyr/event-store/valkyr";
 * import { z } from "@valkyr/event-store";
 *
 * const eventStore = new ValkyrEventStore<MyEvents>({
 *   database: "memorydb",
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

import type { Collection, IndexedDatabase, MemoryDatabase } from "@valkyr/db";
import type { AnyZodObject } from "zod";

import { Validator } from "~libraries/validator.ts";
import { Projector } from "~libraries/projector.ts";
import { createEventRecord } from "~libraries/event.ts";
import { makeReducer } from "~libraries/reducer.ts";
import { EventInsertionFailure, EventProjectionFailure, EventValidationFailure } from "../../libraries/errors.ts";
import type { Empty, Unknown } from "~types/common.ts";
import type { Event, EventRecord, EventStatus, EventToRecord } from "~types/event.ts";
import type { EventHooks } from "~types/event-store.ts";
import type { ReduceHandler, Reducer } from "~types/reducer.ts";

import { type Adapter, type Collections, getEventStoreDatabase } from "./database.ts";

/*
 |--------------------------------------------------------------------------------
 | Event Store
 |--------------------------------------------------------------------------------
 */

/**
 * Provides a solution to easily validate, generate, and project events to a
 * valkyr database.
 */
export class ValkyrEventStore<TEvent extends Event, TRecord extends EventRecord = EventToRecord<TEvent>> {
  readonly #config: Config<TEvent, TRecord>;
  readonly #database: IndexedDatabase<Collections> | MemoryDatabase<Collections>;

  readonly validator: Validator<TRecord>;
  readonly projector: Projector<TRecord>;

  constructor(config: Config<TEvent, TRecord>) {
    this.#config = config;

    this.validator = new Validator<TRecord>();
    this.projector = new Projector<TRecord>();

    this.#database = getEventStoreDatabase(config.database);
  }

  /*
   |--------------------------------------------------------------------------------
   | Accessors
   |--------------------------------------------------------------------------------
   */

  /**
   * @valkyr/db 'events' collection instance which can be accessed to read events
   * data directly from the persisted event store.
   */
  get events(): Collection<EventRecord> {
    // @ts-expect-error Both database instances returns the same collection interface.
    return this.#database.collection("events");
  }

  /*
   |--------------------------------------------------------------------------------
   | Factories
   |--------------------------------------------------------------------------------
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
   * @param event - Event data to record.
   * @param hooks - Event hooks to handle post insert events.
   */
  async add<TEventType extends Event["type"]>(
    event: ExcludeEmptyFields<Extract<TEvent, { type: TEventType }>> & {
      stream?: string;
    },
    hooks: Partial<EventHooks> = {},
  ): Promise<string> {
    return this.push(createEventRecord(event as any) as TRecord, hooks, false);
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
   * @param hooks    - Event hooks to handle post insert events.
   * @param hydrated - Whether the event is hydrated or not. (Optional)
   */
  async push(record: TRecord, hooks: Partial<EventHooks> = {}, hydrated = true): Promise<string> {
    if (this.#config.events.has(record.type) === false) {
      throw new Error(`Event '${record.type}' is not registered with the event store!`);
    }

    const status = await this.getEventStatus(record);
    if (status.exists === true) {
      return record.stream;
    }

    if (hydrated === true) {
      record.recorded = Date.now();
    }

    try {
      await this.validator.validate(record);
    } catch (error) {
      throw new EventValidationFailure(error.message);
    }

    try {
      await this.events.insertOne(record);
    } catch (error) {
      throw new EventInsertionFailure(error.message);
    }

    try {
      await this.projector.project(record, { hydrated, outdated: status.outdated });
    } catch (error) {
      hooks?.afterProjectionError?.(new EventProjectionFailure(error.message));
    }

    if (hydrated === false) {
      this.#config.remote.push(record);
    }

    return record.stream;
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
  async getEventStatus(record: TRecord): Promise<EventStatus> {
    const result = await this.events.findOne({ id: record.id });
    if (result !== undefined) {
      return { exists: true, outdated: true };
    }
    return { exists: false, outdated: await this.getOutdatedState(record) };
  }

  /**
   * Check if provided event record is outdated in relation to the events
   * persisted in the event store instance.
   *
   * @param record - Event record to get outdated state for.
   */
  async getOutdatedState({ stream, type, created }: TRecord): Promise<boolean> {
    const count = await this.events.count({
      stream,
      type,
      created: {
        $gt: created,
      },
    });
    return count > 0;
  }

  /**
   * Retrieve events from the events table.
   *
   * @param options - Read options. (Optional)
   */
  async getEvents({ cursor, direction }: EventReadOptions = {}): Promise<TRecord[]> {
    const filter: any = {};
    if (cursor !== undefined) {
      filter.created = {
        [direction === 1 ? "$gt" : "$lt"]: cursor,
      };
    }
    return (await this.events.find(filter, { sort: { created: 1 } })) as TRecord[];
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
  async getStreamState<Reduce extends ReduceHandler>(
    stream: string,
    reduce: Reduce,
  ): Promise<ReturnType<Reduce> | undefined> {
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
  async getEventsByStream(stream: string, { cursor, direction }: EventReadOptions = {}): Promise<TRecord[]> {
    const filter: any = {};
    if (stream !== undefined) {
      filter.stream = stream;
    }
    if (cursor !== undefined) {
      filter.created = {
        [direction === 1 ? "$gt" : "$lt"]: cursor,
      };
    }
    return (await this.events.find(filter, { sort: { created: 1 } })) as TRecord[];
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
    return this.#config.validators.get(type)!;
  }
}

/*
 |--------------------------------------------------------------------------------
 | Types
 |--------------------------------------------------------------------------------
 */

type Config<E extends Event, Record extends EventRecord> = {
  database: Adapter;
  events: EventList<E>;
  validators: Map<Record["type"], AnyZodObject>;
  remote: {
    push: (record: Record) => Promise<void>;
  };
};

type EventList<E extends Event> = Set<E["type"]>;

type ExcludeEmptyFields<T> = {
  [K in keyof T as T[K] extends Empty ? never : K]: T[K];
};

type EventReadOptions = {
  /**
   * Fetch events from a specific point in time. The direction of which
   * events are fetched is determined by the direction option.
   */
  cursor?: number;

  /**
   * Fetch events in ascending or descending order.
   */
  direction?: 1 | -1;
};
