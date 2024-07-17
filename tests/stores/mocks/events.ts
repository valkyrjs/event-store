import z, { type AnyZodObject } from "zod";

import type { Empty } from "~types/common.ts";
import type { Event as TEvent, EventToRecord } from "~types/event.ts";

export const events = new Set(
  [
    "user:activated",
    "user:created",
    "user:deactivated",
    "user:email_set",
    "user:family_name_set",
    "user:given_name_set",
  ] as const,
);

export const validators = {
  data: new Map<Event["type"], AnyZodObject>([
    [
      "user:created",
      z.object({ name: z.object({ given: z.string(), family: z.string() }).strict(), email: z.string() }).strict(),
    ],
    ["user:email_set", z.object({ email: z.string() }).strict()],
    ["user:family_name_set", z.object({ family: z.string() }).strict()],
    ["user:given_name_set", z.object({ given: z.string() }).strict()],
  ]),
  meta: new Map<Event["type"], AnyZodObject>([
    ["user:activated", z.object({ auditor: z.string() }).strict()],
    ["user:email_set", z.object({ auditor: z.string() }).strict()],
  ]),
};

export type EventRecord = EventToRecord<Event>;

export type Event = UserActivated | UserCreated | UserDeactivated | UserEmailSet | UserFamilyNameSet | UserGivenNameSet;

export type UserActivated = TEvent<"user:activated", Empty, { auditor: string }>;

export type UserCreated = TEvent<"user:created", { name: { given: string; family: string }; email: string }, Empty>;

export type UserDeactivated = TEvent<"user:deactivated", Empty, Empty>;

export type UserEmailSet = TEvent<"user:email_set", { email: string }, { auditor: string }>;

export type UserFamilyNameSet = TEvent<"user:family_name_set", { family: string }, Empty>;

export type UserGivenNameSet = TEvent<"user:given_name_set", { given: string }, Empty>;
