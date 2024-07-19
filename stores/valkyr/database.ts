import { IndexedDatabase, MemoryDatabase } from "@valkyr/db";

import type { EventRecord } from "~types/event.ts";

export function getEventStoreDatabase(adapter: Adapter): EventStoreDB {
  switch (adapter) {
    case "indexedb": {
      return new IndexedDatabase<Collections>({
        name,
        version: 1,
        registrars: [
          {
            name: "events",
            indexes: [
              ["stream", { unique: false }],
              ["created", { unique: false }],
              ["recorded", { unique: false }],
            ],
          },
          {
            name: "contexts",
            indexes: [
              ["key", { unique: false }],
            ],
          },
        ],
      });
    }
    case "memorydb": {
      return new MemoryDatabase<Collections>({
        name,
        registrars: [
          { name: "events" },
          { name: "contexts" },
        ],
      });
    }
  }
}

/*
 |--------------------------------------------------------------------------------
 | Types
 |--------------------------------------------------------------------------------
 */

export type EventStoreDB = IndexedDatabase<Collections> | MemoryDatabase<Collections>;

export type Adapter = "indexedb" | "memorydb";

export type Collections = {
  events: EventRecord;
  contexts: {
    key: string;
    stream: string;
  };
};
