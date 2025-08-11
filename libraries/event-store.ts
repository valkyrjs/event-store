/**
 * @module
 *
 * This module contains an abstract event store solution that can take a variety of
 * provider adapters to support multiple storage drivers.
 *
 * @example
 * ```ts
 * import { EventStore } from "@valkyr/event-store";
 * import { z } from "zod";
 *
 * const eventStore = new EventStore({
 *   adapter: {
 *     providers: {
 *       event: new EventProvider(db),
 *       relations: new RelationsProvider(db),
 *       snapshot: new SnapshotProvider(db),
 *     },
 *   },
 *   events: [
 *     event
 *       .type("user:created")
 *       .data(
 *         z.strictObject({
 *           name: z.string(),
 *           email: z.string().check(z.email())
 *         }),
 *       )
 *       .meta(z.string()),
 *   ],
 * });
 * ```
 */

import { EventStoreAdapter } from "../types/adapter.ts";
import type { Unknown } from "../types/common.ts";
import type { EventReadOptions, ReduceQuery } from "../types/query.ts";
import { AggregateRootClass } from "./aggregate.ts";
import { EventInsertionError, EventMissingError, EventValidationError } from "./errors.ts";
import { EventStatus } from "./event.ts";
import { EventFactory } from "./event-factory.ts";
import type { InferReducerState, Reducer, ReducerLeftFold, ReducerState } from "./reducer.ts";
import { makeAggregateReducer, makeReducer } from "./reducer.ts";

/*
 |--------------------------------------------------------------------------------
 | Event Store
 |--------------------------------------------------------------------------------
 */

/**
 * Provides a common interface to interact with a event storage solution. Its built
 * on an adapter pattern to allow for multiple different storage drivers.
 */
export class EventStore<TEventFactory extends EventFactory, TEventStoreAdapter extends EventStoreAdapter<any>> {
  readonly uuid: string;

  readonly #adapter: TEventStoreAdapter;
  readonly #events: TEventFactory;
  readonly #snapshot: "manual" | "auto";
  readonly #hooks: EventStoreHooks<TEventFactory>;

  declare readonly $events: TEventFactory["$events"];
  declare readonly $records: TEventFactory["$events"][number]["$record"][];

  constructor(config: EventStoreConfig<TEventFactory, TEventStoreAdapter>) {
    this.uuid = crypto.randomUUID();
    this.#adapter = config.adapter;
    this.#events = config.events;
    this.#snapshot = config.snapshot ?? "manual";
    this.#hooks = config.hooks ?? {};
  }

  /*
   |--------------------------------------------------------------------------------
   | Accessors
   |--------------------------------------------------------------------------------
   */

  get db(): TEventStoreAdapter["db"] {
    return this.#adapter.db;
  }

  get events(): TEventStoreAdapter["providers"]["events"] {
    return this.#adapter.providers.events;
  }

  get relations(): TEventStoreAdapter["providers"]["relations"] {
    return this.#adapter.providers.relations;
  }

  get snapshots(): TEventStoreAdapter["providers"]["snapshots"] {
    return this.#adapter.providers.snapshots;
  }

  /*
   |--------------------------------------------------------------------------------
   | Event Handlers
   |--------------------------------------------------------------------------------
   */

  onEventsInserted(fn: EventStoreHooks<TEventFactory>["onEventsInserted"]) {
    this.#hooks.onEventsInserted = fn;
  }

  /*
   |--------------------------------------------------------------------------------
   | Aggregates
   |--------------------------------------------------------------------------------
   */

  readonly aggregate = {
    /**
     * Takes a list of aggregates and commits any pending events to the event store.
     * Events are committed in order so its important to ensure that the aggregates
     * are placed in the correct index position of the array.
     *
     * This method allows for a simpler way to commit many events over many
     * aggregates in a single transaction. Ensuring atomicity of a larger group
     * of events.
     *
     * @param aggregates - Aggregates to push events from.
     * @param settings   - Event settings which can modify insertion behavior.
     *
     * @example
     * ```ts
     * const foo = eventStore.aggregate.from(Foo).setEvent(...);
     * const bar = eventStore.aggregate.from(Bar).setEvent(...);
     *
     * await eventStore.aggregate.push([foo, bar]);
     * ```
     */
    push: async (
      aggregates: InstanceType<AggregateRootClass<TEventFactory>>[],
      settings?: EventsInsertSettings,
    ): Promise<void> => {
      const events: this["$events"][number]["$record"][] = [];
      for (const aggregate of aggregates) {
        events.push(...aggregate.toPending());
      }
      await this.pushManyEvents(events, settings);
      for (const aggregate of aggregates) {
        aggregate.flush();
      }
    },

    /**
     * Get a new aggregate instance by a given stream.
     *
     * @param name   - Aggregate to instantiate.
     * @param stream - Stream to retrieve snapshot from.
     *
     * @example
     * ```ts
     * const state = await eventStore.aggregate.getByStream(Aggregate, "stream");
     * ```
     */
    getByStream: async <TAggregate extends AggregateRootClass<TEventFactory>>(
      aggregate: TAggregate,
      stream: string,
    ): Promise<InstanceType<TAggregate> | undefined> => {
      const reducer = makeAggregateReducer(this, aggregate);
      const snapshot = await this.reduce({ name: aggregate.name, stream, reducer });
      if (snapshot === undefined) {
        return undefined;
      }
      return aggregate.from(this, snapshot as Unknown);
    },

    /**
     * Get a new aggregate instance by a given relation.
     *
     * @param name     - Aggregate to instantiate.
     * @param relation - Relation to retrieve snapshot from.
     *
     * @example
     * ```ts
     * const state = await eventStore.aggregate.getByRelation(Aggregate, "relation");
     * ```
     */
    getByRelation: async <TAggregate extends AggregateRootClass<TEventFactory>>(
      aggregate: TAggregate,
      relation: string,
    ): Promise<InstanceType<TAggregate> | undefined> => {
      const reducer = makeAggregateReducer(this, aggregate);
      const snapshot = await this.reduce({ name: aggregate.name, relation, reducer });
      if (snapshot === undefined) {
        return undefined;
      }
      return aggregate.from(this, snapshot as Unknown);
    },

    /**
     * Instantiate a new aggreate.
     *
     * @param aggregate - Aggregate to instantiate.
     * @param snapshot  - Optional snapshot to instantiate aggregate with.
     *
     * @example
     * ```ts
     * const foo = await eventStore.aggregate.from(Foo);
     * ```
     */
    from: <TAggregate extends AggregateRootClass<TEventFactory>>(
      aggregate: TAggregate,
      snapshot?: Unknown,
    ): InstanceType<TAggregate> => {
      return aggregate.from(this, snapshot);
    },

    /**
     * Create a new reducer instance for the given aggregate.
     *
     * @param aggregate - Aggregate to create a reducer for.
     *
     * @example
     * ```ts
     * const reducer = eventStore.aggregate.reducer(Aggregate);
     * const state = await eventStore.reduce({ name: "foo:reducer", stream: "stream-id", reducer });
     * ```
     */
    reducer: <TAggregate extends AggregateRootClass<TEventFactory>>(
      aggregate: TAggregate,
    ): Reducer<TEventFactory, InstanceType<TAggregate>> => {
      return makeAggregateReducer(this, aggregate);
    },
  };

  /*
   |--------------------------------------------------------------------------------
   | Events
   |--------------------------------------------------------------------------------
   */

  /**
   * Event factory producing a new event record from one of the events registered
   * with the event store instance.
   *
   * @param payload - Event payload to pass to an available factory.
   */
  event<TType extends TEventFactory["$events"][number]["state"]["type"]>(
    payload: { type: TType } & Extract<TEventFactory["$events"][number], { state: { type: TType } }>["$payload"],
  ): Extract<TEventFactory["$events"][number], { state: { type: TType } }>["$record"] {
    const event = this.#events.get((payload as any).type);
    if (event === undefined) {
      throw new Error(`Event '${(payload as any).type}' not found`);
    }
    return event.record(payload);
  }

  /**
   * Insert an event record to the local event store database.
   *
   * @param record   - Event record to insert.
   * @param settings - Event settings which can modify insertion behavior.
   */
  async pushEvent(record: this["$events"][number]["$record"], settings: EventsInsertSettings = {}): Promise<void> {
    const event = this.#events.get(record.type);
    if (event === undefined) {
      throw new EventMissingError(record.type);
    }
    const validation = event.validate(record);
    if (validation.success === false) {
      throw new EventValidationError(record, validation.errors);
    }
    await this.events.insert(record).catch((error) => {
      throw new EventInsertionError(error.message);
    });
    if (settings.emit !== false) {
      await this.#hooks.onEventsInserted?.([record], settings).catch(this.#hooks.onError ?? console.error);
    }
  }

  /**
   * Add many events in strict sequence to the events table.
   *
   * This method runs in a transaction and will fail all events if one or more
   * insertion failures occurs.
   *
   * @param records  - List of event records to insert.
   * @param settings - Event settings which can modify insertion behavior.
   */
  async pushManyEvents(
    records: this["$events"][number]["$record"][],
    settings: EventsInsertSettings = {},
  ): Promise<void> {
    const events: this["$events"][number]["$record"][] = [];
    for (const record of records) {
      const event = this.#events.get(record.type);
      if (event === undefined) {
        throw new EventMissingError(record.type);
      }
      const validation = event.validate(record);
      if (validation.success === false) {
        throw new EventValidationError(record, validation.errors);
      }
      events.push(record);
    }
    await this.events.insertMany(events).catch((error) => {
      throw new EventInsertionError(error.message);
    });
    if (settings.emit !== false) {
      await this.#hooks.onEventsInserted?.(events, settings).catch(this.#hooks.onError ?? console.error);
    }
  }

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
  async getEventStatus(event: this["$events"][number]["$record"]): Promise<EventStatus> {
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
  async getEvents(options?: EventReadOptions): Promise<this["$events"][number]["$record"][]> {
    return this.events.get(options);
  }

  /**
   * Retrieve events from the events table under the given streams.
   *
   * @param streams - Streams to retrieve events for.
   * @param options - Read options to pass to the provider. (Optional)
   */
  async getEventsByStreams(
    streams: string[],
    options?: EventReadOptions,
  ): Promise<TEventFactory["$events"][number]["$record"][]> {
    return this.events.getByStreams(streams, options);
  }

  /**
   * Retrieve all events under the given relational keys.
   *
   * @param keys    - Relational keys to retrieve events for.
   * @param options - Relational logic options. (Optional)
   */
  async getEventsByRelations(
    keys: string[],
    options?: EventReadOptions,
  ): Promise<TEventFactory["$events"][number]["$record"][]> {
    const streamIds = await this.relations.getByKeys(keys);
    if (streamIds.length === 0) {
      return [];
    }
    return this.events.getByStreams(streamIds, options);
  }

  /*
   |--------------------------------------------------------------------------------
   | Reducers
   |--------------------------------------------------------------------------------
   */

  /**
   * Make a new event reducer based on the events registered with the event store.
   *
   * @param reducer - Reducer method to run over given events.
   * @param state   - Initial state.
   *
   * @example
   * ```ts
   * const reducer = eventStore.makeReducer<{ name: string }>((state, event) => {
   *   switch (event.type) {
   *     case "FooCreated": {
   *       state.name = event.data.name;
   *       break;
   *     }
   *   }
   *   return state;
   * }, () => ({
   *   name: ""
   * }));
   *
   * const state = await eventStore.reduce({ name: "foo:reducer", stream: "stream-id", reducer });
   * ```
   */
  makeReducer<TState extends Unknown>(
    foldFn: ReducerLeftFold<TState, TEventFactory>,
    stateFn: ReducerState<TState>,
  ): Reducer<TEventFactory, TState> {
    return makeReducer<TEventFactory, TState>(foldFn, stateFn);
  }

  /**
   * Reduce events in the given stream to a entity state.
   *
   * @param query   - Reducer query to resolve event state from.
   * @param pending - List of non comitted events to append to the server events.
   *
   * @example
   * ```ts
   * const reducer = eventStore.aggregate.reducer(Aggregate);
   * const state = await eventStore.reduce({ stream, reducer });
   * const state = await eventStore.reduce({ relation: `foo:${foo}:bars`, reducer });
   * ```
   */
  async reduce<TReducer extends Reducer>(
    { name, stream, relation, reducer, ...query }: ReduceQuery<TReducer>,
    pending: TEventFactory["$events"][number]["$record"][] = [],
  ): Promise<ReturnType<TReducer["reduce"]> | undefined> {
    const id = stream ?? relation;

    let state: InferReducerState<TReducer> | undefined;
    let cursor: string | undefined;

    const snapshot = await this.snapshot.get(name, id);
    if (snapshot !== undefined) {
      cursor = snapshot.cursor;
      state = snapshot.state;
    }

    const events = (
      stream !== undefined
        ? await this.getEventsByStreams([id], { ...query, cursor })
        : await this.getEventsByRelations([id], { ...query, cursor })
    ).concat(pending);

    if (events.length === 0) {
      if (state !== undefined) {
        return reducer.from(state);
      }
      return undefined;
    }

    const result = reducer.reduce(events, state);
    if (this.#snapshot === "auto") {
      await this.snapshots.insert(name, id, events.at(-1)!.created, result);
    }
    return result;
  }

  /*
   |--------------------------------------------------------------------------------
   | Snapshots
   |--------------------------------------------------------------------------------
   */

  readonly snapshot = {
    /**
     * Create a new snapshot for the given stream/relation and reducer.
     *
     * @param query - Reducer query to create snapshot from.
     *
     * @example
     * ```ts
     * await eventStore.createSnapshot({ stream, reducer });
     * await eventStore.createSnapshot({ relation: `foo:${foo}:bars`, reducer });
     * ```
     */
    create: async <TReducer extends Reducer>({
      name,
      stream,
      relation,
      reducer,
      ...query
    }: ReduceQuery<TReducer>): Promise<void> => {
      const id = stream ?? relation;
      const events =
        stream !== undefined
          ? await this.getEventsByStreams([id], query)
          : await this.getEventsByRelations([id], query);
      if (events.length === 0) {
        return undefined;
      }
      await this.snapshots.insert(name, id, events.at(-1)!.created, reducer.reduce(events));
    },

    /**
     * Get an entity state snapshot from the database. These are useful for when we
     * want to reduce the amount of events that has to be processed when fetching
     * state history for a reducer.
     *
     * @param streamOrRelation - Stream, or Relation to get snapshot for.
     * @param reducer          - Reducer to get snapshot for.
     *
     * @example
     * ```ts
     * const snapshot = await eventStore.getSnapshot("foo:reducer", stream);
     * console.log(snapshot);
     * // {
     * //   cursor: "jxubdY-0",
     * //   state: {
     * //     foo: "bar"
     * //   }
     * // }
     *
     * const snapshot = await eventStore.getSnapshot("foo:reducer", `foo:${foo}:bars`);
     * console.log(snapshot);
     * // {
     * //   cursor: "jxubdY-0",
     * //   state: {
     * //     count: 1
     * //   }
     * // }
     * ```
     */
    get: async <TReducer extends Reducer, TState = InferReducerState<TReducer>>(
      name: string,
      streamOrRelation: string,
    ): Promise<{ cursor: string; state: TState } | undefined> => {
      const snapshot = await this.snapshots.getByStream(name, streamOrRelation);
      if (snapshot === undefined) {
        return undefined;
      }
      return { cursor: snapshot.cursor, state: snapshot.state as TState };
    },

    /**
     * Delete a snapshot.
     *
     * @param streamOrRelation - Stream, or Relation to delete snapshot for.
     * @param reducer          - Reducer to remove snapshot for.
     *
     * @example
     * ```ts
     * await eventStore.deleteSnapshot("foo:reducer", stream);
     * await eventStore.deleteSnapshot("foo:reducer", `foo:${foo}:bars`);
     * ```
     */
    delete: async (name: string, streamOrRelation: string): Promise<void> => {
      await this.snapshots.remove(name, streamOrRelation);
    },
  };
}

/*
 |--------------------------------------------------------------------------------
 | Types
 |--------------------------------------------------------------------------------
 */

type EventStoreConfig<TEventFactory extends EventFactory, TEventStoreAdapter extends EventStoreAdapter<any>> = {
  adapter: TEventStoreAdapter;
  events: TEventFactory;
  snapshot?: "manual" | "auto";
  hooks?: EventStoreHooks<TEventFactory>;
};

export type EventsInsertSettings = {
  /**
   * Should the event store emit events after successfull insertion.
   * This only takes false as value and by default events are always
   * projected.
   */
  emit?: false;

  /**
   * Batch key that can be used to group several events in a single
   * batched operation for performance sensitive handling.
   */
  batch?: string;
};

export type EventStoreHooks<TEventFactory extends EventFactory> = Partial<{
  /**
   * Triggered when `.pushEvent` and `.pushManyEvents` has completed successfully.
   *
   * @param records  - List of event records inserted.
   * @param settings - Event insert settings used.
   */
  onEventsInserted(
    records: TEventFactory["$events"][number]["$record"][],
    settings: EventsInsertSettings,
  ): Promise<void>;

  /**
   * Triggered when an unhandled exception is thrown during `.pushEvent` and
   * `.pushManyEvents` hook.
   *
   * @param error - Error that was thrown.
   */
  onError(error: unknown): Promise<void>;
}>;

export type AnyEventStore = EventStore<any, any>;
