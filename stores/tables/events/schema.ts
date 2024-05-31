import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const events = sqliteTable("valkyr_events", {
  id: text("id").primaryKey(),
  stream: text("stream").notNull(),
  type: text("type").notNull(),
  data: text("data", { mode: "json" }).$type<Record<string, any>>().notNull(),
  meta: text("meta", { mode: "json" }).$type<Record<string, any>>().notNull(),
  recorded: integer("recorded").notNull(),
  created: integer("created").notNull(),
}, (table) => ({
  streamIdx: index("stream_idx").on(table.stream),
  typeIdx: index("type_idx").on(table.type),
  recordedIdx: index("recorded_idx").on(table.recorded),
  createdIdx: index("created_idx").on(table.created),
}));
