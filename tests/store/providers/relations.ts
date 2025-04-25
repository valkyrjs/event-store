import { assertEquals } from "@std/assert";
import { it } from "@std/testing/bdd";
import { nanoid } from "nanoid";

import type { EventStoreFactory } from "../../mocks/events.ts";
import { describe } from "../../utilities/describe.ts";

export default describe<EventStoreFactory>("relations", (getEventStore) => {
  it("should create a new relation", async () => {
    const { store } = await getEventStore();

    const key = "sample";
    const stream = nanoid();

    await store.relations.insert(key, stream);

    assertEquals(await store.relations.getByKey(key), [stream]);
  });

  it("should ignore duplicate relations", async () => {
    const { store } = await getEventStore();

    const key = "sample";
    const stream = nanoid();

    await store.relations.insertMany([
      { key, stream },
      { key, stream },
    ]);
    await store.relations.insert(key, stream);

    assertEquals(await store.relations.getByKey(key), [stream]);
  });
});
