import { assertEquals } from "@std/assert";
import { it } from "@std/testing/bdd";
import { nanoid } from "nanoid";

import type { EventStoreFactory } from "../mocks/events.ts";
import { userReducer } from "../mocks/user-reducer.ts";
import { describe } from "../utilities/describe.ts";

export default describe<EventStoreFactory>(".reduce", (getEventStore) => {
  it("should return reduced state", async () => {
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

    const state = await store.reduce({ name: "user", stream, reducer: userReducer });

    assertEquals(state, {
      name: { given: "John", family: "Doe" },
      email: "jane.doe@fixture.none",
      active: true,
      posts: { list: [], count: 0 },
    });
  });

  it("should return snapshot if it exists and no new events were found", async () => {
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

    await store.createSnapshot({ name: "user", stream, reducer: userReducer });

    const state = await store.reduce({ name: "user", stream, reducer: userReducer });

    assertEquals(state, {
      name: { given: "John", family: "Doe" },
      email: "jane.doe@fixture.none",
      active: true,
      posts: { list: [], count: 0 },
    });
  });

  it("should return undefined if stream does not have events", async () => {
    const stream = nanoid();
    const { store } = await getEventStore();
    const state = await store.reduce({ name: "user", stream, reducer: userReducer });

    assertEquals(state, undefined);
  });
});
