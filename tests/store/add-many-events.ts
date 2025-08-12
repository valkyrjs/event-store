import { assertEquals, assertObjectMatch, assertRejects } from "@std/assert";
import { it } from "@std/testing/bdd";

import { EventValidationError } from "../../mod.ts";
import type { Events } from "../mocks/events.ts";
import { userReducer } from "../mocks/user-reducer.ts";
import { describe } from "../utilities/describe.ts";

export default describe<Events>(".addSequence", (getEventStore) => {
  it("should insert 'user:created', 'user:name:given-set', and 'user:email-set' in a sequence of events", async () => {
    const { store } = await getEventStore();
    const stream = crypto.randomUUID();

    const events = [
      store.event({
        stream,
        type: "user:created",
        data: {
          name: {
            given: "Jane",
            family: "Doe",
          },
          email: "jane.doe@fixture.none",
        },
        meta: {
          auditor: "admin",
        },
      }),
      store.event({
        stream,
        type: "user:name:given-set",
        data: "John",
        meta: {
          auditor: "admin",
        },
      }),
      store.event({
        stream,
        type: "user:email-set",
        data: "john@doe.com",
        meta: {
          auditor: "admin",
        },
      }),
    ];

    await store.pushManyEvents(events);

    const records = await store.getEventsByStreams([stream]);

    assertEquals(records.length, 3);

    records.forEach((record, index) => {
      assertObjectMatch(record, events[index]);
    });

    const state = await store.reduce({ name: "user", stream, reducer: userReducer });

    assertEquals(state?.name.given, "John");
    assertEquals(state?.email, "john@doe.com");
  });

  it("should not commit any events when insert fails", async () => {
    const { store } = await getEventStore();
    const stream = crypto.randomUUID();

    await assertRejects(
      async () =>
        store.pushManyEvents([
          store.event({
            stream,
            type: "user:created",
            data: {
              name: {
                given: "Jane",
                family: "Doe",
              },
              email: "jane.doe@fixture.none",
            },
            meta: {
              auditor: "admin",
            },
          }),
          store.event({
            stream,
            type: "user:name:given-set",
            data: {
              givens: "John",
            },
          } as any),
          store.event({
            stream,
            type: "user:email-set",
            data: "john@doe.com",
            meta: {
              auditor: "admin",
            },
          }),
        ]),
      EventValidationError,
    );

    const records = await store.getEventsByStreams([stream]);

    assertEquals(records.length, 0);
  });
});
