import { index, varchar } from "drizzle-orm/pg-core";

import { schema } from "../schema.ts";

export const contexts = schema.table("contexts", {
  key: varchar("key").notNull(),
  stream: varchar("stream").notNull(),
}, (table) => ({
  keyIdx: index("key_idx").on(table.key),
}));
