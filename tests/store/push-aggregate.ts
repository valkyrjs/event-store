import { assertEquals, assertObjectMatch } from "@std/assert";
import { it } from "@std/testing/bdd";

import { User } from "../mocks/aggregates.ts";
import type { Events } from "../mocks/events.ts";
import { userReducer } from "../mocks/user-reducer.ts";
import { describe } from "../utilities/describe.ts";

export default describe<Events>(".pushAggregate", (getEventStore) => {
  it("should successfully commit pending aggregate events to the event store", async () => {
    const { store } = await getEventStore();

    const user = store.aggregate
      .from(User)
      .setGivenName("Jane")
      .setFamilyName("Doe")
      .setEmail("jane.doe@fixture.none", "admin")
      .setGivenName("John")
      .setEmail("john.doe@fixture.none", "admin");

    assertEquals(user.toPending().length, 5);

    await user.save();

    assertEquals(user.toPending().length, 0);

    const records = await store.getEventsByStreams([user.id]);

    assertEquals(records.length, 5);

    assertObjectMatch(records[0], { stream: user.id, data: "Jane" });
    assertObjectMatch(records[1], { stream: user.id, data: "Doe" });
    assertObjectMatch(records[2], { stream: user.id, data: "jane.doe@fixture.none", meta: { auditor: "admin" } });
    assertObjectMatch(records[3], { stream: user.id, data: "John" });
    assertObjectMatch(records[4], { stream: user.id, data: "john.doe@fixture.none", meta: { auditor: "admin" } });

    const state = await store.reduce({ name: "user", stream: user.id, reducer: userReducer });

    assertObjectMatch(state!, {
      name: {
        given: "John",
        family: "Doe",
      },
      email: "john.doe@fixture.none",
    });
  });
});
