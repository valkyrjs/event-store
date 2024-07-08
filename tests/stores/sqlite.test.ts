import { Database } from "sqlite";
import { z } from "zod";

import { assertEquals } from "std/assert/mod.ts";
import { beforeEach, describe, it } from "std/testing/bdd.ts";

import { EventDataValidationFailure, EventValidationFailure } from "~libraries/store.ts";
import { migrate, SQLiteEventStore } from "~stores/sqlite/event-store.ts";
import type { Event } from "~types/event.ts";

/*
 |--------------------------------------------------------------------------------
 | Tests
 |--------------------------------------------------------------------------------
 */

describe("SQLite Event Store", () => {
  let store: SQLiteEventStore<UserEvent>;

  beforeEach(async () => {
    store = await getEventStore();
  });

  it("should successfully handle a UserCreated event", async () => {
    let result: string = "";

    store.projector.on("UserCreated", async (record) => {
      result = `${record.data.name.given} ${record.data.name.family} | ${record.data.email} | ${record.meta.auditor}`;
    });

    await store.add({
      type: "UserCreated",
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
    });

    assertEquals(result, "John Doe | john.doe@fixture.none | super");
  });

  it("should reject UserEmailSet if the email has not changed", async () => {
    const stream = "xyz";

    const userReducer = store.reducer<{
      name: string;
      email: string;
    }>((state, event) => {
      switch (event.type) {
        case "UserCreated": {
          return {
            ...state,
            name: `${event.data.name.given} ${event.data.name.family}`,
            email: event.data.email,
          };
        }
        case "UserEmailSet": {
          return {
            ...state,
            email: event.data.email,
          };
        }
      }
      return state;
    }, {
      name: "",
      email: "",
    });

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
      meta: {
        auditor: "super",
      },
    });

    assertEquals(
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
      new EventValidationFailure("Email has not changed"),
    );
  });

  it("should add a new context", async () => {
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
      meta: {
        auditor: "super",
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
      meta: {
        auditor: "super",
      },
    });

    const res2 = await store.getEventsByContext("tenant:xyz");

    assertEquals(res2.length, 2);
  });

  it("should remove a context", async () => {
    store.contextor.register("UserCreated", () => [
      {
        key: "tenant:xyz",
        op: "insert",
      },
    ]);

    store.contextor.register("UserEmailSet", () => [
      {
        key: "tenant:xyz",
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
      meta: {
        auditor: "super",
      },
    });

    const res1 = await store.getEventsByContext("tenant:xyz");

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

    const res2 = await store.getEventsByContext("tenant:xyz");

    assertEquals(res2.length, 0);
  });

  it("should reject events with invalid data", async () => {
    assertEquals(
      await store.add({
        type: "UserCreated",
        data: {
          name: {
            given: "test",
          },
        },
        meta: {
          auditor: "super",
        },
      } as any),
      new EventDataValidationFailure({
        email: ["Required"],
        name: ["Required"],
      }),
    );
  });
});

/*
 |--------------------------------------------------------------------------------
 | Utilities
 |--------------------------------------------------------------------------------
 */

async function getEventStore() {
  const database = new Database(":memory:");
  const store = new SQLiteEventStore<UserEvent>({
    database,
    events: new Set(
      [
        "UserCreated",
        "UserGivenNameSet",
        "UserFamilyNameSet",
        "UserEmailSet",
      ] as const,
    ),
    validators: new Map<UserEvent["type"], any>([
      [
        "UserCreated",
        z.object({ name: z.object({ given: z.string(), family: z.string() }).strict(), email: z.string() }).strict(),
      ],
      ["UserEmailSet", z.object({ email: z.string() }).strict()],
      ["UserFamilyNameSet", z.object({ family: z.string() }).strict()],
      ["UserGivenNameSet", z.object({ given: z.string() }).strict()],
    ]),
  });
  await migrate(database);
  return store;
}

/*
 |--------------------------------------------------------------------------------
 | Events
 |--------------------------------------------------------------------------------
 */

type UserEvent = UserCreated | UserGivenNameSet | UserFamilyNameSet | UserEmailSet;

type UserCreated = Event<
  "UserCreated",
  {
    name: {
      given: string;
      family: string;
    };
    email: string;
  },
  { auditor: string }
>;
type UserGivenNameSet = Event<"UserGivenNameSet", { given: string }, { auditor: string }>;
type UserFamilyNameSet = Event<"UserFamilyNameSet", { family: string }, { auditor: string }>;
type UserEmailSet = Event<"UserEmailSet", { email: string }, { auditor: string }>;
