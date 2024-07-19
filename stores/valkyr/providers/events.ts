import type { Collection } from "@valkyr/db";

import type { EventRecord } from "~types/event.ts";

export class EventsProvider {
  constructor(readonly events: Collection<EventRecord>) {}

  /**
   * Insert a new event record to the events table.
   *
   * @param record - Event record to insert.
   * @param tx     - Transaction to insert the record within. (Optional)
   */
  async insert(record: EventRecord): Promise<void> {
    await this.events.insertOne(record);
  }

  /**
   * Retrieve all the events in the events table. Optionally a cursor and direction
   * can be provided to reduce the list of events returned.
   *
   * @param options - Find options.
   */
  async find({ cursor, direction }: EventReadOptions = {}): Promise<EventRecord[]> {
    const filter: any = {};
    if (cursor !== undefined) {
      filter.created = {
        [direction === 1 ? "$gt" : "$lt"]: cursor,
      };
    }
    return this.events.find(filter, { sort: { created: 1 } });
  }

  async getByStream(stream: string, { cursor, direction }: EventReadOptions = {}): Promise<EventRecord[]> {
    const filter: any = {};
    if (stream !== undefined) {
      filter.stream = stream;
    }
    if (cursor !== undefined) {
      filter.created = {
        [direction === 1 ? "$gt" : "$lt"]: cursor,
      };
    }
    return this.events.find(filter, { sort: { created: 1 } });
  }

  async getByStreams(streams: string[]): Promise<EventRecord[]> {
    return this.events.find({ stream: { $in: streams } }, { sort: { created: 1 } });
  }

  async getById(id: string): Promise<EventRecord | undefined> {
    return this.events.findById(id);
  }

  async checkOutdated({ stream, type, created }: EventRecord): Promise<boolean> {
    const count = await this.events.count({
      stream,
      type,
      created: {
        $gt: created,
      },
    });
    return count > 0;
  }
}

type EventReadOptions = {
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
