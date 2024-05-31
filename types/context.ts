import type { EventRecord } from "./event.ts";

export type ContextHandler<Record extends EventRecord> = (record: Record) => Omit<Context, "stream">[];

export type Context = {
  key: string;
  op: "insert" | "remove";
  stream: string;
};
