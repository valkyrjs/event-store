import { index, type PgColumn, type PgTableWithColumns, varchar } from "drizzle-orm/pg-core";

import { schema } from "../schema.ts";

export const contexts: ContextTable = schema.table("contexts", {
  key: varchar("key").notNull(),
  stream: varchar("stream").notNull(),
}, (table) => ({
  keyIdx: index("key_idx").on(table.key),
}));

type ContextTable = PgTableWithColumns<{
  name: "contexts";
  schema: "event_store";
  columns: {
    key: PgColumn<{
      name: "key";
      tableName: "contexts";
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
      tableName: "contexts";
      dataType: "string";
      columnType: "PgVarchar";
      data: string;
      driverParam: string;
      notNull: true;
      hasDefault: false;
      enumValues: [string, ...string[]];
      baseColumn: never;
    }>;
  };
  dialect: "pg";
}>;
