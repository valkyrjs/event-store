import { assertEquals, assertObjectMatch } from "@std/assert";
import { it } from "@std/testing/bdd";

import { User } from "../mocks/aggregates.ts";
import type { Events } from "../mocks/events.ts";
import { userReducer } from "../mocks/user-reducer.ts";
import { describe } from "../utilities/describe.ts";

export default describe<Events>(".pushManyAggregates", (getEventStore) => {
  it("should successfully commit pending aggregates events to the event store", async () => {
    const { store } = await getEventStore();

    const userA = store.aggregate
      .from(User)
      .setGivenName("Jane")
      .setFamilyName("Doe")
      .setEmail("jane.doe@fixture.none", "admin")
      .setGivenName("John")
      .setEmail("john.doe@fixture.none", "admin");

    const userB = store.aggregate
      .from(User)
      .setGivenName("Peter")
      .setFamilyName("Doe")
      .setEmail("peter.doe@fixture.none", "admin")
      .setGivenName("Barry")
      .setEmail("barry.doe@fixture.none", "admin");

    assertEquals(userA.toPending().length, 5);
    assertEquals(userB.toPending().length, 5);

    await store.aggregate.push([userA, userB]);

    assertEquals(userA.toPending().length, 0);
    assertEquals(userB.toPending().length, 0);

    const records = await store.getEventsByStreams([userA.id, userB.id]);

    assertEquals(records.length, 10);

    assertObjectMatch(records[0], { stream: userA.id, data: "Jane" });
    assertObjectMatch(records[1], { stream: userA.id, data: "Doe" });
    assertObjectMatch(records[2], { stream: userA.id, data: "jane.doe@fixture.none", meta: { auditor: "admin" } });
    assertObjectMatch(records[3], { stream: userA.id, data: "John" });
    assertObjectMatch(records[4], { stream: userA.id, data: "john.doe@fixture.none", meta: { auditor: "admin" } });
    assertObjectMatch(records[5], { stream: userB.id, data: "Peter" });
    assertObjectMatch(records[6], { stream: userB.id, data: "Doe" });
    assertObjectMatch(records[7], { stream: userB.id, data: "peter.doe@fixture.none", meta: { auditor: "admin" } });
    assertObjectMatch(records[8], { stream: userB.id, data: "Barry" });
    assertObjectMatch(records[9], { stream: userB.id, data: "barry.doe@fixture.none", meta: { auditor: "admin" } });

    const stateA = await store.reduce({ name: "user", stream: userA.id, reducer: userReducer });
    const stateB = await store.reduce({ name: "user", stream: userB.id, reducer: userReducer });

    assertObjectMatch(stateA!, {
      name: {
        given: "John",
        family: "Doe",
      },
      email: "john.doe@fixture.none",
    });

    assertObjectMatch(stateB!, {
      name: {
        given: "Barry",
        family: "Doe",
      },
      email: "barry.doe@fixture.none",
    });
  });
});
