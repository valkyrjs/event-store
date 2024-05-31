import type { EventRecord } from "./event.ts";

export type Reducer<S, E extends EventRecord> = (state: S, event: E) => S;

export type ReduceHandler<S = any, E = any> = (events: E[]) => S;
