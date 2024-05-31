import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const contexts = sqliteTable("valkyr_contexts", {
  key: text("key").notNull(),
  stream: text("stream").notNull(),
}, (table) => ({
  keyIdx: index("key_idx").on(table.key),
}));
