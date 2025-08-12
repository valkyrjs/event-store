import { assertEquals, assertObjectMatch } from "@std/assert";
import { it } from "@std/testing/bdd";

import type { Events } from "../mocks/events.ts";
import { describe } from "../utilities/describe.ts";

export default describe<Events>("projector.once", (getEventStore) => {
  it("should handle successfull projection", async () => {
    const { store, projector } = await getEventStore();

    const stream = crypto.randomUUID();
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
        auditor: "foo",
      },
    });

    let emailId: string | Error | undefined;

    projector.once(
      "user:created",
      async () => {
        return { id: "fake-email-id" };
      },
      {
        async onError({ error }) {
          emailId = error as Error;
        },
        async onSuccess({ data }) {
          emailId = data.id;
        },
      },
    );

    await store.pushEvent(event);

    assertObjectMatch(await store.events.getByStream(stream).then((rows: any) => rows[0]), event);
    assertEquals(emailId, "fake-email-id");
  });

  it("should handle failed projection", async () => {
    const { store, projector } = await getEventStore();

    const stream = crypto.randomUUID();
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
        auditor: "foo",
      },
    });

    let emailId: string | undefined;

    projector.once(
      "user:created",
      async () => {
        fakeEmail();
      },
      {
        async onError({ error }) {
          emailId = (error as Error).message;
        },
        async onSuccess() {},
      },
    );

    await store.pushEvent(event);

    assertObjectMatch(await store.events.getByStream(stream).then((rows: any) => rows[0]), event);
    assertEquals(emailId, "Failed to send email!");
  });
});

function fakeEmail() {
  throw new Error("Failed to send email!");
}
