import type { Collection, FindCursor } from "mongodb";

import { EventRecord } from "../../../libraries/event.ts";
import type { EventsProvider } from "../../../types/adapter.ts";
import type { EventReadOptions } from "../../../types/query.ts";
import { type EventSchema, schema } from "../collections/events.ts";
import { DatabaseAccessor } from "../types.ts";
import { toParsedRecord, toParsedRecords } from "../utilities.ts";

export class MongoEventsProvider implements EventsProvider {
  readonly #accessor: DatabaseAccessor;

  constructor(accessor: DatabaseAccessor) {
    this.#accessor = accessor;
  }

  get collection(): Collection<EventSchema> {
    return this.#accessor.db.collection<EventSchema>("events");
  }

  /**
   * Insert a new event record to the events table.
   *
   * @param record - Event record to insert.
   * @param tx     - Transaction to insert the record within. (Optional)
   */
  async insert(record: EventRecord): Promise<void> {
    await this.collection.insertOne(record, { forceServerObjectId: true });
  }

  /**
   * Insert many new event records to the events table.
   *
   * @param records - Event records to insert.
   */
  async insertMany(records: EventRecord[]): Promise<void> {
    await this.collection.insertMany(records, { forceServerObjectId: true });
  }

  /**
   * Retrieve all the events in the events table. Optionally a cursor and direction
   * can be provided to reduce the list of events returned.
   *
   * @param options - Find options.
   */
  async get(options: EventReadOptions = {}): Promise<EventRecord[]> {
    return (await this.#withReadOptions(this.collection.find(this.#withFilters(options)), options)
      .sort({ created: 1 })
      .toArray()
      .then(toParsedRecords(schema))) as EventRecord[];
  }

  /**
   * Get events within the given stream.
   *
   * @param stream  - Stream to fetch events for.
   * @param options - Read options for modifying the result.
   */
  async getByStream(stream: string, options: EventReadOptions = {}): Promise<EventRecord[]> {
    return (await this.#withReadOptions(this.collection.find({ stream, ...this.#withFilters(options) }), options)
      .sort({ created: 1 })
      .toArray()
      .then(toParsedRecords(schema))) as EventRecord[];
  }

  /**
   * Get events within given list of streams.
   *
   * @param streams - Stream to get events for.
   * @param options - Read options for modifying the result.
   */
  async getByStreams(streams: string[], options: EventReadOptions = {}): Promise<EventRecord[]> {
    return (await this.#withReadOptions(
      this.collection.find({ stream: { $in: streams }, ...this.#withFilters(options) }),
      options,
    )
      .sort({ created: 1 })
      .toArray()
      .then(toParsedRecords(schema))) as EventRecord[];
  }

  /**
   * Get a single event by its id.
   *
   * @param id - Event id.
   */
  async getById(id: string): Promise<EventRecord | undefined> {
    return (await this.collection.findOne({ id }).then(toParsedRecord(schema))) as EventRecord | undefined;
  }

  /**
   * Check if the given event is outdated in relation to the local event data.
   *
   * @param event - Event record to check for outdated state for.
   */
  async checkOutdated({ stream, type, created }: EventRecord): Promise<boolean> {
    const count = await this.collection.countDocuments({
      stream,
      type,
      created: {
        $gt: created,
      },
    });
    return count > 0;
  }

  /*
   |--------------------------------------------------------------------------------
   | Utilities
   |--------------------------------------------------------------------------------
   */

  #withFilters({ filter }: EventReadOptions): { type?: { $in: string[] } } {
    const types = filter?.types;
    if (types !== undefined) {
      return { type: { $in: types } };
    }
    return {};
  }

  #withReadOptions(fc: FindCursor, { cursor, direction, limit }: EventReadOptions): FindCursor {
    if (cursor !== undefined) {
      if (direction === "desc" || direction === -1) {
        fc.filter({ created: { $lt: cursor } });
      } else {
        fc.filter({ created: { $gt: cursor } });
      }
    }
    if (limit !== undefined) {
      fc.limit(limit);
    }
    return fc;
  }
}
