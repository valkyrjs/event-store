import { assertEquals } from "@std/assert";
import { it } from "@std/testing/bdd";

import { User } from "../mocks/aggregates.ts";
import type { Events } from "../mocks/events.ts";
import { describe } from "../utilities/describe.ts";

export default describe<Events>(".makeAggregateReducer", (getEventStore) => {
  it("should reduce a user", async () => {
    const { store } = await getEventStore();

    const userA = await store.aggregate
      .from(User)
      .setGivenName("Jane")
      .setFamilyName("Doe")
      .setEmail("john.doe@fixture.none", "auditor")
      .save();

    await userA.snapshot();

    await userA.setFamilyName("Smith").setEmail("jane.smith@fixture.none", "system").save();

    const userB = await store.aggregate.getByStream(User, userA.id);
    if (userB === undefined) {
      throw new Error("Expected user to exist");
    }

    assertEquals(userB.fullName(), "Jane Smith");
    assertEquals(userB.email, "jane.smith@fixture.none");
  });
});
