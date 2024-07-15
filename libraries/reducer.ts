import type { Unknown } from "../types/common.ts";
import type { EventRecord } from "../types/event.ts";
import type { ReduceHandler, Reducer } from "../types/reducer.ts";

/**
 * Make an even reducer that produces a state based on incoming events.
 *
 * @param reducer      - Method which handles the event reduction.
 * @param initialState - Initial state in which to apply events.
 */
export function makeReducer<TState extends Unknown, TRecord extends EventRecord>(
  reducer: Reducer<TState, TRecord>,
  initialState: Partial<TState> = {} as Partial<TState>,
): ReduceHandler<TState, TRecord> {
  return (events: TRecord[]) => events.reduce(reducer, initialState as TState);
}
