import type { Helper } from "postgres";

import type { EventRecord } from "../../../libraries/event.ts";
import type { EventsProvider } from "../../../types/adapter.ts";
import type { EventReadOptions } from "../../../types/query.ts";
import type { Options, PostgresDatabase } from "../database.ts";

type PGEventRecord = Omit<EventRecord, "data" | "meta"> & { data: string; meta: string };

export class PostgresEventsProvider implements EventsProvider {
  constructor(
    readonly db: PostgresDatabase,
    readonly schema?: string,
  ) {}

  get table(): Helper<string, []> {
    if (this.schema !== undefined) {
      return this.db.sql(`${this.schema}.events`);
    }
    return this.db.sql("public.events");
  }

  /**
   * Insert a new event record to the events table.
   *
   * @param record - Event record to insert.
   */
  async insert(record: EventRecord, { tx }: Options = {}): Promise<void> {
    await (tx ?? this.db.sql)`INSERT INTO ${this.table} ${this.db.sql(this.#toDriver(record))}`.catch((error) => {
      throw new Error(`EventStore > 'events.insert' failed with postgres error: ${error.message}`);
    });
  }

  /**
   * Insert many new event records to the events table.
   *
   * @param records   - Event records to insert.
   * @param batchSize - Batch size for the insert loop.
   */
  async insertMany(records: EventRecord[], batchSize: number = 1_000, { tx }: Options = {}): Promise<void> {
    if (tx !== undefined) {
      for (let i = 0; i < records.length; i += batchSize) {
        await tx`INSERT INTO ${this.table} ${this.db.sql(records.slice(i, i + batchSize).map(this.#toDriver))}`;
      }
    } else {
      await this.db.sql
        .begin(async (sql) => {
          for (let i = 0; i < records.length; i += batchSize) {
            await sql`INSERT INTO ${this.table} ${this.db.sql(records.slice(i, i + batchSize).map(this.#toDriver))}`;
          }
        })
        .catch((error) => {
          throw new Error(`EventStore > 'events.insertMany' failed with postgres error: ${error.message}`);
        });
    }
  }

  /**
   * Retrieve all the events in the events table. Optionally a cursor and direction
   * can be provided to reduce the list of events returned.
   *
   * @param options - Find options.
   */
  async get(options: EventReadOptions, { tx }: Options = {}): Promise<EventRecord[]> {
    if (options !== undefined) {
      const { filter, cursor, direction, limit } = options;
      return (tx ?? this.db.sql)<PGEventRecord[]>`
        SELECT * FROM ${this.table} 
        WHERE
          ${filter?.types ? this.#withTypes(filter.types) : this.db.sql``}
          ${cursor ? this.#withCursor(cursor, direction) : this.db.sql``}
        ORDER BY created ASC
        ${limit ? this.#withLimit(limit) : this.db.sql``}
      `.then(this.#fromDriver);
    }
    return this.db.sql<PGEventRecord[]>`SELECT * FROM ${this.table} ORDER BY created ASC`.then(this.#fromDriver);
  }

  /**
   * Get events within the given stream.
   *
   * @param stream  - Stream to fetch events for.
   * @param options - Read options for modifying the result.
   */
  async getByStream(
    stream: string,
    { filter, cursor, direction, limit }: EventReadOptions = {},
    { tx }: Options = {},
  ): Promise<EventRecord[]> {
    return (tx ?? this.db.sql)<PGEventRecord[]>`
      SELECT * FROM ${this.table} 
      WHERE 
        stream = ${stream}
        ${filter?.types ? this.#withTypes(filter.types) : this.db.sql``}
        ${cursor ? this.#withCursor(cursor, direction) : this.db.sql``}
      ORDER BY created ASC
      ${limit ? this.#withLimit(limit) : this.db.sql``}
    `.then(this.#fromDriver);
  }

  /**
   * Get events within given list of streams.
   *
   * @param streams - Stream to get events for.
   * @param options - Read options for modifying the result.
   */
  async getByStreams(
    streams: string[],
    { filter, cursor, direction, limit }: EventReadOptions = {},
    { tx }: Options = {},
  ): Promise<EventRecord[]> {
    return (tx ?? this.db.sql)<PGEventRecord[]>`
      SELECT * FROM ${this.table} 
      WHERE 
        stream IN ${this.db.sql(streams)}
        ${filter?.types ? this.#withTypes(filter.types) : this.db.sql``}
        ${cursor ? this.#withCursor(cursor, direction) : this.db.sql``}
      ORDER BY created ASC
      ${limit ? this.#withLimit(limit) : this.db.sql``}
    `.then(this.#fromDriver);
  }

  /**
   * Get a single event by its id.
   *
   * @param id - Event id.
   */
  async getById(id: string, { tx }: Options = {}): Promise<EventRecord | undefined> {
    return (tx ?? this.db.sql)<PGEventRecord[]>`SELECT * FROM ${this.table} WHERE id = ${id}`
      .then(this.#fromDriver)
      .then(([record]) => record);
  }

  /**
   * Check if the given event is outdated in relation to the local event data.
   */
  async checkOutdated({ stream, type, created }: EventRecord, { tx }: Options = {}): Promise<boolean> {
    const count = await (tx ?? this.db.sql)`
      SELECT COUNT(*) AS count
      FROM ${this.table}
      WHERE
        stream = ${stream}
        AND type = ${type}
        AND created > ${created}
    `.then((result: any) => Number(result[0]));
    return count > 0;
  }

  /*
   |--------------------------------------------------------------------------------
   | Utilities
   |--------------------------------------------------------------------------------
   */

  #withTypes(types: string[]) {
    return this.db.sql`AND type IN ${this.db.sql(types)}`;
  }

  #withCursor(cursor: string, direction?: 1 | -1 | "asc" | "desc") {
    if (direction === "desc" || direction === -1) {
      return this.db.sql`AND created < ${cursor}`;
    }
    return this.db.sql`AND created > ${cursor}`;
  }

  #withLimit(limit: number) {
    return this.db.sql`LIMIT ${limit}`;
  }

  /*
   |--------------------------------------------------------------------------------
   | Parsers
   |--------------------------------------------------------------------------------
   */

  #fromDriver(records: PGEventRecord[]): EventRecord[] {
    return records.map((record) => {
      record.data = typeof record.data === "string" ? JSON.parse(record.data) : record.data;
      record.meta = typeof record.meta === "string" ? JSON.parse(record.meta) : record.meta;
      return record as unknown as EventRecord;
    });
  }

  #toDriver(record: EventRecord): PGEventRecord {
    return {
      ...record,
      data: JSON.stringify(record.data),
      meta: JSON.stringify(record.meta),
    };
  }
}
