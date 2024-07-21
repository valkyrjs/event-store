import { index, type PgColumn, type PgTableWithColumns, varchar } from "drizzle-orm/pg-core";

import { schema } from "../schema.ts";

export const contexts: Table = schema.table("contexts", {
  key: varchar("key").notNull(),
  stream: varchar("stream").notNull(),
}, (table) => ({
  keyIdx: index().on(table.key),
}));

type Table = PgTableWithColumns<{
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
