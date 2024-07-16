import z, { type AnyZodObject } from "zod";

import type { Empty } from "~types/common.ts";
import type { Event, EventToRecord } from "~types/event.ts";

export const events = new Set(
  [
    "user:created",
    "user:deactivated",
    "user:email_set",
    "user:family_name_set",
    "user:given_name_set",
  ] as const,
);

export const validators = new Map<SystemEvent["type"], AnyZodObject>([
  [
    "user:created",
    z.object({ name: z.object({ given: z.string(), family: z.string() }).strict(), email: z.string() }).strict(),
  ],
  ["user:email_set", z.object({ email: z.string() }).strict()],
  ["user:family_name_set", z.object({ family: z.string() }).strict()],
  ["user:given_name_set", z.object({ given: z.string() }).strict()],
]);

export type SystemEventRecord = EventToRecord<SystemEvent>;

export type SystemEvent = UserCreated | UserDeactivated | UserEmailSet | UserFamilyNameSet | UserGivenNameSet;

export type UserCreated = Event<"user:created", { name: { given: string; family: string }; email: string }, Empty>;

export type UserDeactivated = Event<"user:deactivated", Empty, Empty>;

export type UserEmailSet = Event<"user:email_set", { email: string }, { auditor: string }>;

export type UserFamilyNameSet = Event<"user:family_name_set", { family: string }, Empty>;

export type UserGivenNameSet = Event<"user:given_name_set", { given: string }, Empty>;
