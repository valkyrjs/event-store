import { assertEquals } from "@std/assert";
import { it } from "@std/testing/bdd";

import type { EventStoreFactory } from "../mocks/events.ts";
import { describe } from "../utilities/describe.ts";

export default describe<EventStoreFactory>(".makeAggregateReducer", (getEventStore) => {
  it("should reduce a user", async () => {
    const { store } = await getEventStore();

    const userA = await store
      .aggregate("user")
      .create({ given: "John", family: "Doe" }, "john.doe@fixture.none")
      .setGivenName("Jane")
      .save();

    await userA.snapshot();

    await userA.setFamilyName("Smith").setEmail("jane.smith@fixture.none", "system").save();

    const userB = await store.aggregate("user").getById(userA.id);
    if (userB === undefined) {
      throw new Error("Expected user to exist");
    }

    assertEquals(userB.fullName(), "Jane Smith");
    assertEquals(userB.email, "jane.smith@fixture.none");
  });
});
