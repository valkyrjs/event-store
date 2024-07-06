import { z } from "zod";
import { assertEquals } from "std/assert/mod.ts";
import { beforeEach, describe, it } from "std/testing/bdd.ts";

import { EventValidationFailure } from "~libraries/store.ts";
import type { Event } from "~types/event.ts";

import { ValkyrEventStore } from "~stores/valkyr/event-store.ts";

/*
 |--------------------------------------------------------------------------------
 | Tests
 |--------------------------------------------------------------------------------
 */

describe("Valkyr Event Store", () => {
  let store: ValkyrEventStore<UserEvent>;

  beforeEach(() => {
    store = getEventStore();
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
});

/*
 |--------------------------------------------------------------------------------
 | Utilities
 |--------------------------------------------------------------------------------
 */

function getEventStore() {
  return new ValkyrEventStore<UserEvent>({
    database: "memorydb",
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
    remote: {
      push: async () => {},
    },
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
