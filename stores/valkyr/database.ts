import { IndexedDatabase, MemoryDatabase } from "@valkyr/db";

import { EventRecord } from "~types/event.ts";

export function getEventStoreDatabase(adapter: Adapter): IndexedDatabase<Collections> | MemoryDatabase<Collections> {
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
        ],
      });
    }
    case "memorydb": {
      return new MemoryDatabase<Collections>({
        name,
        registrars: [
          {
            name: "events",
          },
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

export type Adapter = "indexedb" | "memorydb";

export type Collections = { events: EventRecord };
