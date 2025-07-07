import z from "zod/v4";

import type { CollectionRegistrar } from "../types.ts";

export const registrar: CollectionRegistrar = {
  name: "events",
  indexes: [
    [
      {
        stream: 1,
      },
    ],
    [
      {
        type: 1,
      },
    ],
    [
      {
        recorded: 1,
      },
    ],
    [
      {
        created: 1,
      },
    ],
  ],
};

export const schema = z.object({
  id: z.string(),
  stream: z.string(),
  type: z.string(),
  data: z.any(),
  meta: z.any(),
  recorded: z.string(),
  created: z.string(),
});

export type EventSchema = {
  id: string;
  stream: string;
  type: string;
  data: Record<string, any> | null;
  meta: Record<string, any> | null;
  recorded: string;
  created: string;
};
