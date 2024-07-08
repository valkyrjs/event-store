/* eslint-disable @typescript-eslint/no-unused-vars */
// This is an auto generated file. Do not modify this file!

import { type AnyZodObject, type Empty, type Event, z } from "@valkyr/event-store";

export const events = new Set([
  "UserCreated",
  "UserEmailSet",
  "UserDeactivated",
  "UserFamilyNameSet",
  "UserGivenNameSet",
] as const);

export const validators = new Map<
  "UserCreated" | "UserEmailSet" | "UserFamilyNameSet" | "UserGivenNameSet",
  AnyZodObject
>([
  [
    "UserCreated",
    z.object({ name: z.object({ given: z.string(), family: z.string() }).strict(), email: z.string() }).strict(),
  ],
  ["UserEmailSet", z.object({ email: z.string() }).strict()],
  ["UserFamilyNameSet", z.object({ family: z.string() }).strict()],
  ["UserGivenNameSet", z.object({ given: z.string() }).strict()],
]);

export type Events = UserCreated | UserEmailSet | UserDeactivated | UserFamilyNameSet | UserGivenNameSet;

export type UserCreated = Event<"UserCreated", { name: { given: string; family: string }; email: string }, Empty>;

export type UserEmailSet = Event<"UserEmailSet", { email: string }, { auditor: string }>;

export type UserDeactivated = Event<"UserDeactivated", Empty, Empty>;

export type UserFamilyNameSet = Event<"UserFamilyNameSet", { family: string }, Empty>;

export type UserGivenNameSet = Event<"UserGivenNameSet", { given: string }, Empty>;
