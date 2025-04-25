import { assertEquals, assertNotEquals, assertObjectMatch } from "@std/assert";
import { it } from "@std/testing/bdd";
import { nanoid } from "nanoid";

import type { EventStoreFactory } from "../mocks/events.ts";
import { userReducer } from "../mocks/user-reducer.ts";
import { describe } from "../utilities/describe.ts";

export default describe<EventStoreFactory>(".createSnapshot", (getEventStore) => {
  it("should create a new snapshot", async () => {
    const { store } = await getEventStore();
    const stream = nanoid();

    await store.pushEvent(
      store.event({
        stream,
        type: "user:created",
        data: {
          name: {
            given: "John",
            family: "Doe",
          },
          email: "john.doe@fixture.none",
        },
        meta: {
          auditor: "super",
        },
      }),
    );

    await store.pushEvent(
      store.event({
        stream,
        type: "user:email-set",
        data: "jane.doe@fixture.none",
        meta: {
          auditor: "super",
        },
      }),
    );

    await store.pushEvent(
      store.event({
        stream,
        type: "user:deactivated",
        meta: {
          auditor: "super",
        },
      }),
    );

    await store.createSnapshot({ name: "user", stream, reducer: userReducer });

    const snapshot = await store.snapshots.getByStream("user", stream);

    assertNotEquals(snapshot, undefined);
    assertObjectMatch(snapshot!.state, {
      name: {
        given: "John",
        family: "Doe",
      },
      email: "jane.doe@fixture.none",
      active: false,
    });

    await store.pushEvent(
      store.event({
        stream,
        type: "user:activated",
        meta: {
          auditor: "super",
        },
      }),
    );

    const events = await store.events.getByStream(stream, { cursor: snapshot!.cursor });

    assertEquals(events.length, 1);

    const state = await store.reduce({ name: "user", stream, reducer: userReducer });

    assertObjectMatch(state!, {
      name: {
        given: "John",
        family: "Doe",
      },
      email: "jane.doe@fixture.none",
      active: true,
    });
  });
});
