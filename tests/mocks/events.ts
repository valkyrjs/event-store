import z from "zod/v4";

import { event } from "../../libraries/event.ts";
import { EventFactory } from "../../libraries/event-factory.ts";

export const auditor = z.strictObject({ auditor: z.string() });

export const events = new EventFactory([
  event
    .type("user:created")
    .data(
      z.strictObject({
        name: z
          .union([
            z.strictObject({ given: z.string(), family: z.string().optional() }),
            z.strictObject({ given: z.string().optional(), family: z.string() }),
          ])
          .optional(),
        email: z.string(),
      }),
    )
    .meta(auditor),
  event.type("user:name:given-set").data(z.string()).meta(auditor),
  event.type("user:name:family-set").data(z.string()).meta(auditor),
  event.type("user:email-set").data(z.email()).meta(auditor),
  event.type("user:activated").meta(auditor),
  event.type("user:deactivated").meta(auditor),
  event
    .type("post:created")
    .data(z.strictObject({ title: z.string(), body: z.string() }))
    .meta(auditor),
  event.type("post:removed").meta(auditor),
]);

export type EventStoreFactory = typeof events;
