import type { Unknown } from "../types/common.ts";
import type { EventRecord } from "../types/event.ts";
import type { ReduceHandler, Reducer } from "../types/reducer.ts";

export function makeReducer<State extends Unknown, Record extends EventRecord>(
  reducer: Reducer<State, Record>,
  initialState: Partial<State> = {} as Partial<State>,
): ReduceHandler<State, Record> {
  return (events: Record[]) => events.reduce(reducer, initialState as State);
}
