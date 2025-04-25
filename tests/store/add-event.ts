import { assertEquals, assertObjectMatch, assertRejects } from "@std/assert";
import { it } from "@std/testing/bdd";

import { EventInsertionError, EventValidationError } from "../../libraries/errors.ts";
import { makeId } from "../../libraries/nanoid.ts";
import type { EventStoreFactory } from "../mocks/events.ts";
import { describe } from "../utilities/describe.ts";

export default describe<EventStoreFactory>(".addEvent", (getEventStore) => {
  it("should throw a 'EventValidationError' when providing bad event data", async () => {
    const { store } = await getEventStore();

    await assertRejects(
      async () =>
        store.pushEvent(
          store.event({
            type: "user:created",
            data: {
              name: {
                given: "John",
                familys: "Doe",
              },
              email: "john.doe@fixture.none",
            },
          } as any),
        ),
      EventValidationError,
    );
  });

  it("should throw a 'EventInsertionError' on event insertion error", async () => {
    const { store } = await getEventStore();

    store.events.insert = async () => {
      throw new Error("Fake Insert Error");
    };

    await assertRejects(
      async () =>
        store.pushEvent(
          store.event({
            type: "user:created",
            data: {
              name: {
                given: "John",
                family: "Doe",
              },
              email: "john.doe@fixture.none",
            },
            meta: { auditor: "foo" },
          }),
        ),
      EventInsertionError,
      new EventInsertionError().message,
    );
  });

  it("should insert and project 'user:created' event", async () => {
    const { store, projector } = await getEventStore();

    const stream = makeId();
    const event = store.event({
      stream,
      type: "user:created",
      data: {
        name: {
          given: "John",
          family: "Doe",
        },
        email: "john.doe@fixture.none",
      },
      meta: { auditor: "foo" },
    });

    let projectedResult: string = "";

    projector.on("user:created", async (record) => {
      projectedResult = `${record.data.name?.given} ${record.data.name?.family} | ${record.data.email}`;
    });

    await store.pushEvent(event);

    assertObjectMatch(await store.events.getByStream(stream).then((rows: any) => rows[0]), event);
    assertEquals(projectedResult, "John Doe | john.doe@fixture.none");
  });

  it("should insert 'user:created' and ignore 'project' error", async () => {
    const { store, projector } = await getEventStore({
      hooks: {
        async onError() {
          // ...
        },
      },
    });

    const stream = makeId();
    const event = store.event({
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
        auditor: "admin",
      },
    });

    projector.on("user:created", async () => {
      throw new Error();
    });

    await store.pushEvent(event);

    assertObjectMatch(await store.events.getByStream(stream).then((rows: any) => rows[0]), event);
  });

  it("should insert 'user:created' and add it to 'tenant:xyz' relation", async () => {
    const { store, projector } = await getEventStore();

    const key = `tenant:${makeId()}`;

    projector.on("user:created", async ({ stream }) => {
      await store.relations.insert(key, stream);
    });

    await store.pushEvent(
      store.event({
        type: "user:created",
        data: {
          name: {
            given: "John",
            family: "Doe",
          },
          email: "john.doe@fixture.none",
        },
        meta: {
          auditor: "admin",
        },
      }),
    );

    const res1 = await store.getEventsByRelations([key]);

    assertEquals(res1.length, 1);

    await store.pushEvent(
      store.event({
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
    );

    const res2 = await store.getEventsByRelations([key]);

    assertEquals(res2.length, 2);
  });

  it("should insert 'user:email-set' and remove it from 'tenant:xyz' relations", async () => {
    const { store, projector } = await getEventStore();

    const key = `tenant:${makeId()}`;

    projector.on("user:created", async ({ stream }) => {
      await store.relations.insert(key, stream);
    });

    projector.on("user:email-set", async ({ stream }) => {
      await store.relations.remove(key, stream);
    });

    await store.pushEvent(
      store.event({
        stream: "user-1",
        type: "user:created",
        data: {
          name: {
            given: "John",
            family: "Doe",
          },
          email: "john.doe@fixture.none",
        },
        meta: {
          auditor: "admin",
        },
      }),
    );

    const res1 = await store.getEventsByRelations([key]);

    assertEquals(res1.length, 1);

    await store.pushEvent(
      store.event({
        stream: "user-1",
        type: "user:email-set",
        data: "jane.doe@fixture.none",
        meta: {
          auditor: "super",
        },
      }),
    );

    const res2 = await store.getEventsByRelations([key]);

    assertEquals(res2.length, 0);
  });
});
