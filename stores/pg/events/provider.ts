import { and, eq, gt, inArray, lt, sql } from "drizzle-orm";

import type { EventRecord } from "~types/event.ts";
import type { EventReadOptions } from "~types/event-store.ts";
import { type Database, takeOne } from "~utilities/database.ts";

import type { EventStoreDB } from "../database.ts";
import { events as schema } from "./schema.ts";

export class EventProvider {
  constructor(readonly db: Database<EventStoreDB>) {}

  /**
   * Insert a new event record to the events table.
   *
   * @param record - Event record to insert.
   * @param tx     - Transaction to insert the record within. (Optional)
   */
  async insert(record: EventRecord, tx?: Parameters<Parameters<EventStoreDB["transaction"]>[0]>[0]): Promise<void> {
    if (tx !== undefined) {
      await tx.insert(schema).values(record);
    } else {
      await this.db.insert(schema).values(record);
    }
  }

  /**
   * Retrieve all the events in the events table. Optionally a cursor and direction
   * can be provided to reduce the list of events returned.
   *
   * @param options - Find options.
   */
  async find({ cursor, direction }: EventReadOptions = {}): Promise<EventRecord[]> {
    if (cursor !== undefined) {
      if (direction === "desc") {
        return this.db.select().from(schema).where(lt(schema.created, cursor)).orderBy(schema.created);
      }
      return this.db.select().from(schema).where(gt(schema.created, cursor)).orderBy(schema.created);
    }
    return this.db.select().from(schema).orderBy(schema.created);
  }

  async getByStream(stream: string, { cursor, direction }: EventReadOptions = {}): Promise<EventRecord[]> {
    if (cursor !== undefined) {
      if (direction === "desc") {
        return this.db.select().from(schema).where(and(eq(schema.stream, stream), lt(schema.created, cursor))).orderBy(
          schema.created,
        );
      }
      return this.db.select().from(schema).where(and(eq(schema.stream, stream), gt(schema.created, cursor))).orderBy(
        schema.created,
      );
    }
    return this.db.select().from(schema).where(eq(schema.stream, stream)).orderBy(schema.created);
  }

  async getByStreams(streams: string[]): Promise<EventRecord[]> {
    return this.db.select().from(schema).where(inArray(schema.stream, streams)).orderBy(schema.created);
  }

  async getById(id: string): Promise<EventRecord | undefined> {
    return this.db.select().from(schema).where(eq(schema.id, id)).then(takeOne);
  }

  async checkOutdated({ stream, type, created }: EventRecord): Promise<boolean> {
    const { count } = await this.db.select({ count: sql<number>`count(*)` }).from(schema).where(and(
      eq(schema.stream, stream),
      eq(schema.type, type),
      gt(schema.created, created),
    )).then((result) => result[0]);
    return count > 0;
  }
}
