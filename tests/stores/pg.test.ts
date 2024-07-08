import { PostgresTestContainer } from "@valkyr/testcontainers/postgres";
import postgres from "postgres";
import z from "zod";

import { assertEquals } from "std/assert/mod.ts";
import { afterAll, afterEach, beforeAll, describe, it } from "std/testing/bdd.ts";

import { EventDataValidationFailure, EventValidationFailure } from "~libraries/store.ts";
import { migrate, PGEventStore } from "~stores/pg/event-store.ts";
import type { Event } from "~types/event.ts";

const DB_NAME = "sandbox";

const container = await PostgresTestContainer.start("postgres:14");
const store = await getEventStore(container.url(DB_NAME));

/*
 |--------------------------------------------------------------------------------
 | Tests
 |--------------------------------------------------------------------------------
 */

describe("Postgres Event Store", () => {
  beforeAll(async () => {
    await container.create(DB_NAME);
    await migrate(container.client(DB_NAME));
  });

  afterEach(async () => {
    await container.client(DB_NAME)`TRUNCATE "event_store"."contexts","event_store"."events" CASCADE`;
  });

  afterAll(async () => {
    await container.stop();
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
    const store = await getEventStore(container.url(DB_NAME));

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
    const store = await getEventStore(container.url(DB_NAME));

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
      meta: {
        auditor: "super",
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

async function getEventStore(databaseUrl: string) {
  return new PGEventStore<UserEvent>({
    database: postgres(databaseUrl),
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
