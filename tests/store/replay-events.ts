import { assertObjectMatch } from "@std/assert";
import { it } from "@std/testing/bdd";

import type { Events } from "../mocks/events.ts";
import { describe } from "../utilities/describe.ts";

export default describe<Events>(".replayEvents", (getEventStore) => {
  it("should replay events", async () => {
    const { store, projector } = await getEventStore();
    const stream = crypto.randomUUID();

    const record: Record<string, any> = {};

    projector.on("user:created", async ({ stream, data: { name, email } }) => {
      record[stream] = {
        name,
        email,
      };
    });

    projector.on("user:name:given-set", async ({ stream, data }) => {
      record[stream].name.given = data;
    });

    projector.on("user:email-set", async ({ stream, data }) => {
      record[stream].email = data;
    });

    await store.pushManyEvents([
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
    ]);

    assertObjectMatch(record, {
      [stream]: {
        name: {
          given: "John",
          family: "Doe",
        },
        email: "john@doe.com",
      },
    });

    delete record[stream];

    const promises = [];

    const records = await store.getEventsByStreams([stream]);
    for (const record of records) {
      promises.push(projector.push(record, { hydrated: true, outdated: false }));
    }

    await Promise.all(promises);

    assertObjectMatch(record, {
      [stream]: {
        name: {
          given: "John",
          family: "Doe",
        },
        email: "john@doe.com",
      },
    });
  });
});
