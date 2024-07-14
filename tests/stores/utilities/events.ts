import z from "zod";

import type { Empty } from "~types/common.ts";
import type { Event, EventToRecord } from "~types/event.ts";

export const events = new Set(
  [
    "UserCreated",
    "UserGivenNameSet",
    "UserFamilyNameSet",
    "UserEmailSet",
    "UserDeactivated",
  ] as const,
);

export const validators = new Map<UserEvent["type"], any>([
  [
    "UserCreated",
    z.object({ name: z.object({ given: z.string(), family: z.string() }).strict(), email: z.string() }).strict(),
  ],
  ["UserEmailSet", z.object({ email: z.string() }).strict()],
  ["UserFamilyNameSet", z.object({ family: z.string() }).strict()],
  ["UserGivenNameSet", z.object({ given: z.string() }).strict()],
]);

export type UserEventRecord = EventToRecord<UserEvent>;

export type UserEvent = UserCreated | UserGivenNameSet | UserFamilyNameSet | UserEmailSet | UserDeactivated;

type UserCreated = Event<
  "UserCreated",
  {
    name: {
      given: string;
      family: string;
    };
    email: string;
  },
  Empty
>;
type UserGivenNameSet = Event<"UserGivenNameSet", { given: string }, Empty>;
type UserFamilyNameSet = Event<"UserFamilyNameSet", { family: string }, Empty>;
type UserEmailSet = Event<"UserEmailSet", { email: string }, { auditor: string }>;
type UserDeactivated = Event<"UserDeactivated", Empty, Empty>;
