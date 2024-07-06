import type { EventRecord } from "./event.ts";

export type Reducer<TState, TEvent extends EventRecord> = (state: TState, event: TEvent) => TState;

export type ReduceHandler<TState = any, TEvent = any> = (events: TEvent[]) => TState;
