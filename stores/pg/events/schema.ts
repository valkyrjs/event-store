import { bigint, index, jsonb, varchar } from "drizzle-orm/pg-core";

import { schema } from "../schema.ts";

export const events = schema.table("events", {
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
