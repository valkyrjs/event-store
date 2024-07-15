import { nanoid } from "nanoid";
import { assertEquals, assertObjectMatch, assertRejects } from "std/assert/mod.ts";
import { describe, it } from "std/testing/bdd.ts";

import { EventDataValidationFailure, EventInsertionFailure, EventValidationFailure } from "~libraries/errors.ts";
import type { PGEventStore } from "~stores/pg/event-store.ts";
import type { SQLiteEventStore } from "~stores/sqlite/event-store.ts";
import type { EventHooks } from "~types/event-store.ts";

import { CustomServiceError } from "../mocks/errors.ts";
import type { UserEvent, UserEventRecord } from "../mocks/events.ts";
import { getUserReducer } from "../mocks/user-reducer.ts";

export function testEventStoreMethods(
  getEventStore: (
    hooks?: EventHooks<UserEventRecord>,
  ) => Promise<PGEventStore<UserEvent> | SQLiteEventStore<UserEvent>>,
) {
  describe(".add", () => {
    it("should throw a 'EventValidationFailure' on data validation error", async () => {
      const store = await getEventStore();

      assertRejects(
        async () =>
          store.add({
            type: "UserCreated",
            data: {
              name: {
                given: "John",
                familys: "Doe",
              },
              email: "john.doe@fixture.none",
            },
          } as any),
        EventDataValidationFailure,
        new EventDataValidationFailure({}).message,
      );
    });

    it("should throw a 'CustomServiceError' using 'beforeEventError' on data validation error", async () => {
      const store = await getEventStore({
        async beforeEventError() {
          return new CustomServiceError();
        },
      });

      assertRejects(
        async () =>
          store.add({
            type: "UserCreated",
            data: {
              name: {
                given: "John",
                familys: "Doe",
              },
              email: "john.doe@fixture.none",
            },
          } as any),
        CustomServiceError,
        "Custom Error",
      );
    });

    it("should throw a 'EventValidationFailure' on event validation error", async () => {
      const store = await getEventStore();

      store.validator.on("UserCreated", async () => {
        throw new Error("Test Failure");
      });

      assertRejects(
        async () =>
          store.add({
            type: "UserCreated",
            data: {
              name: {
                given: "John",
                family: "Doe",
              },
              email: "john.doe@fixture.none",
            },
          }),
        EventValidationFailure,
        "Test Failure",
      );
    });

    it("should throw a 'CustomServiceError' using 'beforeEventError' on event validation error", async () => {
      const store = await getEventStore({
        async beforeEventError(error) {
          return new CustomServiceError(error.message);
        },
      });

      store.validator.on("UserCreated", async () => {
        throw new Error("Test Failure");
      });

      assertRejects(
        async () =>
          store.add({
            type: "UserCreated",
            data: {
              name: {
                given: "John",
                family: "Doe",
              },
              email: "john.doe@fixture.none",
            },
          }),
        CustomServiceError,
        "Test Failure",
      );
    });

    it("should throw a 'EventInsertionFailure' on event insertion error", async () => {
      const store = await getEventStore();

      store.events.insert = async () => {
        throw new Error("Fake Insert Error");
      };

      assertRejects(
        async () =>
          store.add({
            type: "UserCreated",
            data: {
              name: {
                given: "John",
                family: "Doe",
              },
              email: "john.doe@fixture.none",
            },
          }),
        EventInsertionFailure,
        new EventInsertionFailure().message,
      );
    });

    it("should throw a 'CustomServiceError' using 'beforeEventError' on event insertion error", async () => {
      const store = await getEventStore({
        async beforeEventError(error) {
          return new CustomServiceError(error.message);
        },
      });

      store.events.insert = async () => {
        throw new Error("Fake Insert Error");
      };

      assertRejects(
        async () =>
          store.add({
            type: "UserCreated",
            data: {
              name: {
                given: "John",
                family: "Doe",
              },
              email: "john.doe@fixture.none",
            },
          }),
        CustomServiceError,
        "Fake Insert Error",
      );
    });

    it("should insert and project 'UserCreated' event", async () => {
      const store = await getEventStore();

      const event = {
        type: "UserCreated",
        data: {
          name: {
            given: "John",
            family: "Doe",
          },
          email: "john.doe@fixture.none",
        },
      } as const;

      let projectedResult: string = "";

      store.projector.on("UserCreated", async (record) => {
        projectedResult = `${record.data.name.given} ${record.data.name.family} | ${record.data.email}`;
      });

      const stream = await store.add(event);

      assertObjectMatch(await store.events.getByStream(stream).then((rows) => rows[0]), event);
      assertEquals(projectedResult, "John Doe | john.doe@fixture.none");
    });

    it("should insert 'UserCreated' and ignore 'project' error", async () => {
      const store = await getEventStore();

      const event = {
        type: "UserCreated",
        data: {
          name: {
            given: "John",
            family: "Doe",
          },
          email: "john.doe@fixture.none",
        },
      } as const;

      store.projector.on("UserCreated", async () => {
        throw new Error();
      });

      const stream = await store.add(event);

      assertObjectMatch(await store.events.getByStream(stream).then((rows) => rows[0]), event);
    });

    it("should insert 'UserCreated' and log 'project' error via 'afterEventError'", async () => {
      let projectionErrorLog: string = "";

      const store = await getEventStore({
        afterEventError(error, record) {
          projectionErrorLog = `${record.type} | ${error.message}`;
        },
      });

      const event = {
        type: "UserCreated",
        data: {
          name: {
            given: "John",
            family: "Doe",
          },
          email: "john.doe@fixture.none",
        },
      } as const;

      store.projector.on("UserCreated", async (record) => {
        throw new Error(record.data.email);
      });

      const stream = await store.add(event);

      assertObjectMatch(await store.events.getByStream(stream).then((rows) => rows[0]), event);
      assertEquals(projectionErrorLog, "UserCreated | john.doe@fixture.none");
    });

    it("should insert 'UserCreated' and add it to 'tenant:xyz' context", async () => {
      const store = await getEventStore();

      store.contextor.register("UserCreated", () => [
        {
          key: "tenant:xyz",
          op: "insert",
        },
      ]);

      await store.add({
        type: "UserCreated",
        data: {
          name: {
            given: "John",
            family: "Doe",
          },
          email: "john.doe@fixture.none",
        },
      });

      const res1 = await store.getEventsByContext("tenant:xyz");

      assertEquals(res1.length, 1);

      await store.add({
        type: "UserCreated",
        data: {
          name: {
            given: "Jane",
            family: "Doe",
          },
          email: "jane.doe@fixture.none",
        },
      });

      const res2 = await store.getEventsByContext("tenant:xyz");

      assertEquals(res2.length, 2);
    });

    it("should insert 'UserEmailSet' and remove it from 'tenant:xyz' context", async () => {
      const store = await getEventStore();

      store.contextor.register("UserCreated", () => [
        {
          key: "tenant:zyx",
          op: "insert",
        },
      ]);

      store.contextor.register("UserEmailSet", () => [
        {
          key: "tenant:zyx",
          op: "remove",
        },
      ]);

      await store.add({
        stream: "user-1",
        type: "UserCreated",
        data: {
          name: {
            given: "John",
            family: "Doe",
          },
          email: "john.doe@fixture.none",
        },
      });

      const res1 = await store.getEventsByContext("tenant:zyx");

      assertEquals(res1.length, 1);

      await store.add({
        stream: "user-1",
        type: "UserEmailSet",
        data: {
          email: "jane.doe@fixture.none",
        },
        meta: {
          auditor: "super",
        },
      });

      const res2 = await store.getEventsByContext("tenant:zyx");

      assertEquals(res2.length, 0);
    });
  });

  describe(".addSequence", () => {
    it("should insert 'UserCreated', 'UserGivenNameSet', and 'UserEmailSet' in a sequence of events", async () => {
      const store = await getEventStore();
      const stream = nanoid();

      const events = [
        {
          stream,
          type: "UserCreated",
          data: {
            name: {
              given: "Jane",
              family: "Doe",
            },
            email: "jane.doe@fixture.none",
          },
        } as const,
        {
          stream,
          type: "UserGivenNameSet",
          data: {
            given: "John",
          },
        } as const,
        {
          stream,
          type: "UserEmailSet",
          data: {
            email: "john@doe.com",
          },
          meta: {
            auditor: "admin",
          },
        } as const,
      ];

      await store.addSequence(events);

      const records = await store.getEventsByStream(stream);

      assertEquals(records.length, 3);

      records.forEach((record, index) => {
        assertObjectMatch(record, events[index]);
      });

      const state = await store.getStreamState(stream, getUserReducer(store));

      assertEquals(state?.name.given, "John");
      assertEquals(state?.email, "john@doe.com");
    });

    it("should not commit any events when insert fails", async () => {
      const store = await getEventStore();
      const stream = nanoid();

      const events = [
        {
          stream,
          type: "UserCreated",
          data: {
            name: {
              given: "Jane",
              family: "Doe",
            },
            email: "jane.doe@fixture.none",
          },
        } as const,
        {
          stream,
          type: "UserGivenNameSet",
          data: {
            givens: "John",
          },
        } as any,
        {
          stream,
          type: "UserEmailSet",
          data: {
            email: "john@doe.com",
          },
          meta: {
            auditor: "admin",
          },
        } as const,
      ];

      assertRejects(
        async () => store.addSequence(events),
        EventDataValidationFailure,
        new EventDataValidationFailure({}).message,
      );

      const records = await store.getEventsByStream(stream);

      assertEquals(records.length, 0);
    });
  });

  describe(".reducer", () => {
    it("should create a 'user' reducer and reject a 'UserEmailSet' event", async () => {
      const store = await getEventStore();
      const stream = nanoid();

      const userReducer = getUserReducer(store);

      store.validator.on("UserEmailSet", async (record) => {
        const user = await store.getStreamState(stream, userReducer);
        if (user === undefined) {
          throw new Error("Event stream does not exist");
        }
        if (user.email === record.data.email) {
          throw new Error("Email has not changed");
        }
      });

      await store.add({
        stream,
        type: "UserCreated",
        data: {
          name: {
            given: "John",
            family: "Doe",
          },
          email: "john.doe@fixture.none",
        },
      });

      assertRejects(
        async () =>
          await store.add({
            stream,
            type: "UserEmailSet",
            data: {
              email: "john.doe@fixture.none",
            },
            meta: {
              auditor: "super",
            },
          }),
        EventValidationFailure,
        "Email has not changed",
      );
    });
  });
}
