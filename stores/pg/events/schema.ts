import { bigint, index, jsonb, type PgColumn, type PgTableWithColumns, varchar } from "drizzle-orm/pg-core";

import { schema } from "../schema.ts";

export const events: EventTable = schema.table("events", {
  id: varchar("id").primaryKey(),
  stream: varchar("stream").notNull(),
  type: varchar("type").notNull(),
  data: jsonb("data").$type<Record<string, any>>().notNull(),
  meta: jsonb("meta").$type<Record<string, any>>().notNull(),
  recorded: bigint("recorded", { mode: "number" }).notNull(),
  created: bigint("created", { mode: "number" }).notNull(),
}, (table) => ({
  streamIdx: index("stream_idx").on(table.stream),
  typeIdx: index("type_idx").on(table.type),
  recordedIdx: index("recorded_idx").on(table.recorded),
  createdIdx: index("created_idx").on(table.created),
}));

type EventTable = PgTableWithColumns<{
  name: "events";
  schema: "event_store";
  columns: {
    id: PgColumn<{
      name: "id";
      tableName: "events";
      dataType: "string";
      columnType: "PgVarchar";
      data: string;
      driverParam: string;
      notNull: true;
      hasDefault: false;
      enumValues: [string, ...string[]];
      baseColumn: never;
    }>;
    stream: PgColumn<{
      name: "stream";
      tableName: "events";
      dataType: "string";
      columnType: "PgVarchar";
      data: string;
      driverParam: string;
      notNull: true;
      hasDefault: false;
      enumValues: [string, ...string[]];
      baseColumn: never;
    }>;
    type: PgColumn<{
      name: "type";
      tableName: "events";
      dataType: "string";
      columnType: "PgVarchar";
      data: string;
      driverParam: string;
      notNull: true;
      hasDefault: false;
      enumValues: [string, ...string[]];
      baseColumn: never;
    }>;
    data: PgColumn<{
      name: "data";
      tableName: "events";
      dataType: "json";
      columnType: "PgJsonb";
      data: Record<string, any>;
      driverParam: unknown;
      notNull: true;
      hasDefault: false;
      enumValues: undefined;
      baseColumn: never;
    }>;
    meta: PgColumn<{
      name: "meta";
      tableName: "events";
      dataType: "json";
      columnType: "PgJsonb";
      data: Record<string, any>;
      driverParam: unknown;
      notNull: true;
      hasDefault: false;
      enumValues: undefined;
      baseColumn: never;
    }>;
    recorded: PgColumn<{
      name: "recorded";
      tableName: "events";
      dataType: "number";
      columnType: "PgBigInt53";
      data: number;
      driverParam: number | string;
      notNull: true;
      hasDefault: false;
      enumValues: undefined;
      baseColumn: never;
    }>;
    created: PgColumn<{
      name: "created";
      tableName: "events";
      dataType: "number";
      columnType: "PgBigInt53";
      data: number;
      driverParam: number | string;
      notNull: true;
      hasDefault: false;
      enumValues: undefined;
      baseColumn: never;
    }>;
  };
  dialect: "pg";
}>;
