import type { PostEventInsertError, PreEventInsertError } from "~libraries/errors.ts";

import type { Unknown } from "./common.ts";
import type { Event, EventRecord, EventStatus } from "./event.ts";
import type { ReduceHandler, Reducer } from "./reducer.ts";
import type { ExcludeEmptyFields } from "./utilities.ts";

/*
 |--------------------------------------------------------------------------------
 | Event Store
 |--------------------------------------------------------------------------------
 */

export type EventStore<TEvent extends Event, TRecord extends EventRecord> = {
  /**
   * Check if the event store has an even of given type.
   *
   * @param type - Event type to check for.
   */
  has(type: TEvent["type"]): boolean;

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
  reducer<TState extends Unknown>(reducer: Reducer<TState, TRecord>, state: TState): ReduceHandler<TState, TRecord>;

  /*
   |--------------------------------------------------------------------------------
   | Writers
   |--------------------------------------------------------------------------------
   */

  /**
   * Push a new event onto the local event store database.
   *
   * Push is meant to take events from the local services and insert them as new
   * event records as non hydrated events.
   *
   * @param event - Event data to record.
   */
  add<TEventType extends Event["type"]>(
    event: ExcludeEmptyFields<Extract<TEvent, { type: TEventType }>> & { stream?: string },
  ): Promise<string>;

  /**
   * Add multiple new events sequentially onto the local event store database in
   * a all or nothing pattern.
   *
   * @param events - List of events to process.
   */
  addSequence<TEventType extends Event["type"]>(
    event: (ExcludeEmptyFields<Extract<TEvent, { type: TEventType }>> & { stream?: string })[],
  ): Promise<void>;

  /**
   * Insert an event record to the local event store database.
   *
   * This method triggers event validation and projection. If validation fails the
   * event will not be inserted. If the projection fails the projection itself
   * should be handling the error based on its own business logic.
   *
   * When hydration is true the event will be recorded with a new locally generated
   * timestamp as its being recorded locally but is not the originator of the event
   * creation.
   *
   * @param record   - EventRecord to insert.
   * @param hydrated - Whether the event is hydrated or not. (Optional)
   */
  push(record: TRecord, hydrated?: boolean): Promise<string>;

  /**
   * Insert multiple event records sequentially to the local event store database.
   *
   * This is a two step process, first step validates and inserts each event in
   * a commit transaction. Once the commit is successfull the second step projects
   * the inserted records.
   *
   * @param records - List of event records to process.
   */
  pushSequence(records: { record: TRecord; hydrated?: boolean }[]): Promise<void>;

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
  getEventStatus(event: TRecord): Promise<EventStatus>;

  /**
   * Retrieve events from the events table.
   *
   * @param options - Read options. (Optional)
   */
  getEvents(options?: EventReadOptions): Promise<TRecord[]>;

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
  getStreamState<TReducer extends ReduceHandler>(
    stream: string,
    reduce: TReducer,
  ): Promise<ReturnType<TReducer> | undefined>;

  /**
   * Retrieve events from the events table under the given stream.
   *
   * @param stream  - Stream to retrieve events for.
   * @param options - Stream logic options. (Optional)
   */
  getEventsByStream(stream: string, options?: EventReadOptions): Promise<TRecord[]>;
};

/*
 |--------------------------------------------------------------------------------
 | Hooks
 |--------------------------------------------------------------------------------
 */

export type EventHooks<TRecord extends EventRecord> = Partial<{
  /**
   * Before an error is thrown, this hook allows for customizing the error that
   * is thrown. This is useful for when you want to throw a different error that
   * more complies with your project setup.
   *
   * @param error  - Event error that got triggered.
   * @param record - Record that was passed to the event store.
   *
   * @example
   * ```ts
   * const eventStore = new EventStore({
   *   ...config,
   *   hooks: {
   *     beforeEventError(error) {
   *       if (error.step === "validation") {
   *         return new ServerError(error.message);
   *       }
   *       return error;
   *     }
   *   }
   * })
   * ```
   */
  beforeEventError(error: PreEventInsertError, record: TRecord): Promise<Error | unknown>;

  /**
   * After an error is thrown, this hook allows for reacting to a failure that
   * occured during event record insertion. This is useful for reporting issues,
   * especially in the events that failed to project or update contexts.
   *
   * @param error  - Event error that got triggered.
   * @param record - Record that was passed to the event store.
   *
   * @example
   * ```ts
   * const eventStore = new EventStore({
   *   ...config,
   *   hooks: {
   *     async afterEventError(error, record) {
   *       if (error.step === "project") {
   *         await report.projectionFailed(
   *          `Failed to project record '${record.stream}', manual recovery required!`
   *         );
   *       }
   *     }
   *   }
   * })
   * ```
   */
  afterEventError(error: PostEventInsertError, record: TRecord): Promise<void> | void;

  /**
   * After an event record has been successfully inserted, this hooks will
   * trigger, allowing for further non internal operations on the inserted
   * event record.
   *
   * @param record   - Record that was inserted.
   * @param hydrated - Hydrated state of the record.
   */
  afterEventInsert(record: TRecord, hydrated: boolean): Promise<void> | void;
}>;

/*
 |--------------------------------------------------------------------------------
 | Query Types
 |--------------------------------------------------------------------------------
 */

export type EventReadOptions = {
  /**
   * Fetch events from a specific point in time. The direction of which
   * events are fetched is determined by the direction option.
   */
  cursor?: string;

  /**
   * Fetch events in ascending or descending order.
   */
  direction?: 1 | -1;
};

export type Pagination = CursorPagination | OffsetPagination;

export type CursorPagination = {
  /**
   * Fetches streams from the specific cursor. Cursor value represents
   * a stream id.
   */
  cursor: string;

  /**
   * Fetch streams in ascending or descending order.
   */
  direction: 1 | -1;
};

export type OffsetPagination = {
  /**
   * Fetch streams from the specific offset.
   */
  offset: number;

  /**
   * Limit the number of streams to return.
   */
  limit: number;
};
