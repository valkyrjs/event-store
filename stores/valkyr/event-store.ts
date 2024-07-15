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

import { createEventRecord } from "~libraries/event.ts";
import { Projector } from "~libraries/projector.ts";
import { makeReducer } from "~libraries/reducer.ts";
import { getLogicalTimestamp } from "~libraries/time.ts";
import { Validator } from "~libraries/validator.ts";
import type { Unknown } from "~types/common.ts";
import type { Event, EventRecord, EventStatus, EventToRecord } from "~types/event.ts";
import type { EventHooks, EventReadOptions, EventStore } from "~types/event-store.ts";
import type { ReduceHandler, Reducer } from "~types/reducer.ts";
import type { ExcludeEmptyFields } from "~types/utilities.ts";

import { EventInsertionFailure, EventProjectionFailure, EventValidationFailure } from "../../libraries/errors.ts";
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
export class ValkyrEventStore<TEvent extends Event, TRecord extends EventRecord = EventToRecord<TEvent>>
  implements EventStore<TEvent, TRecord> {
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

  has(type: TRecord["type"]): boolean {
    return this.#config.events.has(type);
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

  async add<TEventType extends Event["type"]>(
    event: ExcludeEmptyFields<Extract<TEvent, { type: TEventType }>> & { stream?: string },
  ): Promise<string> {
    return this.push(createEventRecord(event as any) as TRecord, false);
  }

  async addSequence<TEventType extends Event["type"]>(
    _events: (ExcludeEmptyFields<Extract<TEvent, { type: TEventType }>> & { stream?: string })[],
  ): Promise<void> {
    throw new Error("Method 'addSequence' not yet supported in @valkyr/db driver");
  }

  async push(record: TRecord, hydrated = true): Promise<string> {
    if (this.#config.events.has(record.type) === false) {
      throw new Error(`Event '${record.type}' is not registered with the event store!`);
    }

    const status = await this.getEventStatus(record);
    if (status.exists === true) {
      return record.stream;
    }

    if (hydrated === true) {
      record.recorded = getLogicalTimestamp();
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
      this.#config.hooks?.afterEventError?.(new EventProjectionFailure(error.message), record);
    }

    if (hydrated === false) {
      this.#config.remote.push(record);
    }

    return record.stream;
  }

  async pushSequence(_records: { record: TRecord; hydrated?: boolean }[]): Promise<void> {
    throw new Error("Method 'pushSequence' not yet supported in @valkyr/db driver");
  }

  /*
   |--------------------------------------------------------------------------------
   | Readers
   |--------------------------------------------------------------------------------
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

  async getEvents({ cursor, direction }: EventReadOptions = {}): Promise<TRecord[]> {
    const filter: any = {};
    if (cursor !== undefined) {
      filter.created = {
        [direction === 1 ? "$gt" : "$lt"]: cursor,
      };
    }
    return (await this.events.find(filter, { sort: { created: 1 } })) as TRecord[];
  }

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

type Config<TEvent extends Event, TRecord extends EventRecord> = {
  database: Adapter;
  events: EventList<TEvent>;
  validators: Map<TRecord["type"], AnyZodObject>;
  hooks?: EventHooks<TRecord>;
  remote: {
    push: (record: TRecord) => Promise<void>;
  };
};

type EventList<E extends Event> = Set<E["type"]>;
