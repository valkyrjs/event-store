import type { AnyEventStore, EventsInsertSettings } from "../libraries/event-store.ts";
import type { Unknown } from "../types/common.ts";
import { AggregateSnapshotViolation } from "./errors.ts";
import { EventFactory } from "./event-factory.ts";

/**
 * Represents an aggregate root in an event-sourced system.
 *
 * This abstract class serves as a base for domain aggregates that manage
 * state changes through events. It provides functionality for creating
 * instances from snapshots, handling pending events, and committing
 * changes to an event store.
 *
 * @template TEvent - The type of events associated with this aggregate.
 */
export abstract class AggregateRoot<TEventFactory extends EventFactory> {
  /**
   * Unique identifier allowing for easy indexing of aggregate lists.
   */
  static readonly name: string;

  /**
   * Instance used for internal interaction with the originating event store.
   */
  readonly #store: AnyEventStore;

  /**
   * Primary unique identifier for the stream the aggregate belongs to.
   */
  id: string;

  /**
   * List of pending records to push to the parent event store.
   */
  #pending: TEventFactory["$events"][number]["$record"][] = [];

  /**
   * Instantiate a new AggregateRoot with a given event store instance.
   *
   * @param store - Store this aggregate instance acts against.
   */
  constructor(store: AnyEventStore) {
    this.id = crypto.randomUUID();
    this.#store = store;
  }

  // -------------------------------------------------------------------------
  // Accessors
  // -------------------------------------------------------------------------

  get #self(): typeof AggregateRoot<TEventFactory> {
    return this.constructor as typeof AggregateRoot<TEventFactory>;
  }

  /**
   * Does the aggregate have pending events to submit to the event store.
   */
  get isDirty(): boolean {
    return this.#pending.length > 0;
  }

  // -------------------------------------------------------------------------
  // Factories
  // -------------------------------------------------------------------------

  /**
   * Create a new aggregate instance with an optional snapshot. This method
   * exists as a unified way to create new aggregates from a event store
   * adapter and not really meant for aggregate creation outside of the
   * event store.
   *
   * @param snapshot - Snapshot to assign to the aggregate state.
   */
  static from<TEventFactory extends EventFactory, TAggregateRoot extends typeof AggregateRoot<TEventFactory>>(
    this: TAggregateRoot,
    store: AnyEventStore,
    snapshot?: Unknown,
  ): InstanceType<TAggregateRoot> {
    const instance = new (this as any)(store);
    if (snapshot !== undefined) {
      Object.assign(instance, snapshot);
    }
    return instance;
  }

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------

  /**
   * Push a new event record to the pending list of events to commit to
   * a event store. This also submits the record to the `.with`
   * aggregate folder to update the aggregate state.
   *
   * @example
   *
   * const foo = await eventStore.aggregate("foo");
   *
   * foo.push({
   *   type: "foo:bar-set",
   *   stream: foo.id,
   *   data: { bar: "foobar" }
   * });
   *
   * await foo.save();
   *
   * @param event - Event to push into the pending commit pool.
   */
  push<TType extends TEventFactory["$events"][number]["state"]["type"]>(
    record: { type: TType } & Extract<TEventFactory["$events"][number], { state: { type: TType } }>["$payload"],
  ): this {
    const pending = this.#store.event(record);
    this.#pending.push(pending);
    this.with(pending);
    return this;
  }

  /**
   * Processes and applies incoming events to update the aggregate state.
   *
   * @param record - Event record to fold.
   */
  abstract with(record: TEventFactory["$events"][number]["$record"]): void;

  // -------------------------------------------------------------------------
  // Mutators
  // -------------------------------------------------------------------------

  /**
   * Generates a new snapshot for the aggregate instance.
   *
   * If the instance has any pending events, they will be commited before
   * the snapshot operation is executed. If there are special settings for
   * any pending events, make sure to `.save()` before snapshotting.
   */
  async snapshot() {
    const stream = this.id;
    if (stream === undefined) {
      throw new AggregateSnapshotViolation(this.#self.name);
    }
    await this.save();
    const reducer = this.#store.aggregate.reducer(this.#self);
    await this.#store.snapshot.create({
      name: this.#self.name,
      stream,
      reducer,
    });
  }

  /**
   * Saves all pending events to the attached event store.
   *
   * @param settings - Event insert settings.
   * @param flush    - Empty the pending event list after event store push.
   */
  async save(settings?: EventsInsertSettings, flush = true): Promise<this> {
    if (this.isDirty === false) {
      return this;
    }
    await this.#store.pushManyEvents(this.#pending, settings);
    if (flush === true) {
      this.flush();
    }
    return this;
  }

  /**
   * Removes all events from the aggregate #pending list.
   */
  flush(): this {
    this.#pending = [];
    return this;
  }

  // -------------------------------------------------------------------------
  // Converters
  // -------------------------------------------------------------------------

  /**
   * Returns the aggregate pending event record list. This allows for
   * extraction of the pending commit list so that it can be used in
   * event submission across multiple aggregates.
   */
  toPending(): TEventFactory["$events"][number]["$record"][] {
    return this.#pending;
  }
}

export type AggregateRootClass<TEventFactory extends EventFactory> = typeof AggregateRoot<TEventFactory>;
