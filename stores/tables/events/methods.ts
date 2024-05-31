import { and, eq, gt, inArray, lt, sql } from "drizzle-orm";

import type { EventRecord } from "~types/event.ts";

import { db } from "../db.ts";
import { events as schema } from "./schema.ts";

export const events = {
  insert,
  find,
  getByStream,
  getByStreams,
  getById,
  checkOutdated,
};

/**
 * Insert a new event record to the events table.
 *
 * @param record - Event record to insert.
 */
async function insert(record: EventRecord) {
  return db.insert(schema).values(record);
}

/**
 * Retrieve all the events in the events table. Optionally a cursor and direction
 * can be provided to reduce the list of events returned.
 *
 * @param options - Find options.
 */
async function find({ cursor, direction }: EventReadOptions = {}): Promise<EventRecord[]> {
  if (cursor !== undefined) {
    if (direction === 1) {
      return db.select().from(schema).where(gt(schema.created, cursor)).orderBy(schema.created);
    }
    if (direction === -1) {
      return db.select().from(schema).where(lt(schema.created, cursor)).orderBy(schema.created);
    }
  }
  return db.select().from(schema).orderBy(schema.created);
}

async function getByStream(stream: string, { cursor, direction }: EventReadOptions = {}): Promise<EventRecord[]> {
  if (cursor !== undefined) {
    if (direction === 1) {
      return db.select().from(schema).where(and(eq(schema.stream, stream), gt(schema.created, cursor))).orderBy(
        schema.created,
      );
    }
    if (direction === -1) {
      return db.select().from(schema).where(and(eq(schema.stream, stream), lt(schema.created, cursor))).orderBy(
        schema.created,
      );
    }
  }
  return db.select().from(schema).where(eq(schema.stream, stream)).orderBy(schema.created);
}

async function getByStreams(streams: string[]): Promise<EventRecord[]> {
  return db.select().from(schema).where(inArray(schema.stream, streams)).orderBy(schema.created);
}

async function getById(id: string): Promise<EventRecord | undefined> {
  return db.select().from(schema).where(eq(schema.id, id)).then((result) => result[0]);
}

async function checkOutdated({ stream, type, created }: EventRecord): Promise<boolean> {
  const { count } = await db.select({ count: sql<number>`count(*)` }).from(schema).where(and(
    eq(schema.stream, stream),
    eq(schema.type, type),
    gt(schema.created, created),
  )).then((result) => result[0]);
  return count > 0;
}

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
