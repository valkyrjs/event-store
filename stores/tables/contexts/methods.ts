import { and, eq } from "drizzle-orm";

import type { Context } from "~types/context.ts";

import { db } from "../db.ts";
import { contexts as schema } from "./schema.ts";

export const contexts = {
  handle,
  insert,
  getByKey,
  remove,
};

async function handle(contexts: Context[]) {
  for (const context of contexts) {
    if (context.op === "insert") {
      await insert(context);
    }
    if (context.op === "remove") {
      await remove(context);
    }
  }
}

async function insert(context: Context) {
  await db.insert(schema).values({ key: context.key, stream: context.stream });
}

async function getByKey(key: string) {
  return db.select().from(schema).where(eq(schema.key, key));
}

async function remove(context: Context) {
  await db.delete(schema).where(and(eq(schema.key, context.key), eq(schema.stream, context.stream)));
}
