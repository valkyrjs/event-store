import type { EventRecord } from "../libraries/event.ts";
import type { EventReadOptions } from "./query.ts";

export type EventStoreAdapter<TDatabase> = {
  readonly db: TDatabase;
  readonly providers: {
    readonly events: EventsProvider;
    readonly relations: RelationsProvider;
    readonly snapshots: SnapshotsProvider;
  };
};

/*
 |--------------------------------------------------------------------------------
 | Events Provider
 |--------------------------------------------------------------------------------
 */

export type EventsProvider = {
  /**
   * Insert a new event record to the events table.
   *
   * @param record - Event record to insert.
   */
  insert(record: EventRecord): Promise<void>;

  /**
   * Insert many new event records to the events table.
   *
   * @param records   - Event records to insert.
   * @param batchSize - Batch size for the insert loop. Default: 1_000
   */
  insertMany(records: EventRecord[], batchSize?: number): Promise<void>;

  /**
   * Retrieve all the events in the events table. Optionally a cursor and direction
   * can be provided to reduce the list of events returned.
   *
   * @param options - Find options.
   */
  get(options?: EventReadOptions): Promise<EventRecord[]>;

  /**
   * Get events within the given stream.
   *
   * @param stream  - Stream to fetch events for.
   * @param options - Read options for modifying the result.
   */
  getByStream(stream: string, options?: EventReadOptions): Promise<EventRecord[]>;

  /**
   * Get events within given list of streams.
   *
   * @param streams - Stream to get events for.
   * @param options - Read options for modifying the result.
   */
  getByStreams(streams: string[], options?: EventReadOptions): Promise<EventRecord[]>;

  /**
   * Get a single event by its id.
   *
   * @param id - Event id.
   */
  getById(id: string): Promise<EventRecord | undefined>;

  /**
   * Check if the given event is outdated in relation to the local event data.
   */
  checkOutdated({ stream, type, created }: EventRecord): Promise<boolean>;
};

/*
 |--------------------------------------------------------------------------------
 | Relations
 |--------------------------------------------------------------------------------
 */

export type RelationsProvider = {
  /**
   * Handle incoming relation operations.
   *
   * @param relations - List of relation operations to execute.
   */
  handle(relations: Relation[]): Promise<void>;

  /**
   * Add stream to the relations table.
   *
   * @param key    - Relational key to add stream to.
   * @param stream - Stream to add to the key.
   */
  insert(key: string, stream: string): Promise<void>;

  /**
   * Add stream to many relational keys onto the relations table.
   *
   * @param relations - Relations to insert.
   * @param batchSize - Batch size for the insert loop. Default: 1_000
   */
  insertMany(relations: RelationPayload[], batchSize?: number): Promise<void>;

  /**
   * Get a list of event streams registered under the given relational key.
   *
   * @param key - Relational key to get event streams for.
   */
  getByKey(key: string): Promise<string[]>;

  /**
   * Get a list of event streams registered under the given relational keys.
   *
   * @param keys - Relational keys to get event streams for.
   */
  getByKeys(keys: string[]): Promise<string[]>;

  /**
   * Removes a stream from the relational table.
   *
   * @param key    - Relational key to remove stream from.
   * @param stream - Stream to remove from relation.
   */
  remove(key: string, stream: string): Promise<void>;

  /**
   * Removes multiple relational entries.
   *
   * @param relations - Relations to remove stream from.
   * @param batchSize - Batch size for the insert loop. Default: 1_000
   */
  removeMany(relations: RelationPayload[], batchSize?: number): Promise<void>;

  /**
   * Remove all relations bound to the given relational keys.
   *
   * @param keys - Relational keys to remove from the relational table.
   */
  removeByKeys(keys: string[]): Promise<void>;

  /**
   * Remove all relations bound to the given streams.
   *
   * @param streams - Streams to remove from the relational table.
   */
  removeByStreams(streams: string[]): Promise<void>;
};

export type RelationHandler<TRecord extends EventRecord> = (record: TRecord) => Promise<Omit<Relation, "stream">[]>;

export type RelationPayload = Omit<Relation, "op">;

export type Relation = {
  op: "insert" | "remove";
  key: string;
  stream: string;
};

/*
 |--------------------------------------------------------------------------------
 | Snapshots
 |--------------------------------------------------------------------------------
 */

export type SnapshotsProvider = {
  /**
   * Add snapshot state under given reducer stream.
   *
   * @param name   - Name of the reducer the snapshot is attached to.
   * @param stream - Stream the snapshot is attached to.
   * @param cursor - Cursor timestamp for the last event used in the snapshot.
   * @param state  - State of the reduced events.
   */
  insert(name: string, stream: string, cursor: string, state: Record<string, unknown>): Promise<void>;

  /**
   * Get snapshot state by stream.
   *
   * @param name   - Name of the reducer which the state was created.
   * @param stream - Stream the state was reduced for.
   */
  getByStream(name: string, stream: string): Promise<Snapshot | undefined>;

  /**
   * Removes a snapshot for the given reducer stream.
   *
   * @param name   - Name of the reducer the snapshot is attached to.
   * @param stream - Stream to remove from snapshots.
   */
  remove(name: string, stream: string): Promise<void>;
};

export type Snapshot = {
  stream: string;
  name: string;
  cursor: string;
  state: Record<string, unknown>;
};
