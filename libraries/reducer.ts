import type { AggregateRoot } from "../libraries/aggregate.ts";
import type { Unknown } from "../types/common.ts";
import { EventFactory } from "./event-factory.ts";

/**
 * Make an event reducer that produces a aggregate instance from resolved
 * events.
 *
 * @param aggregate - Aggregate to instantiate and create an instance of.
 */
export function makeAggregateReducer<TEventFactory extends EventFactory, TAggregateRoot extends typeof AggregateRoot<TEventFactory>>(
  aggregate: TAggregateRoot,
): Reducer<TEventFactory, InstanceType<TAggregateRoot>> {
  return {
    from(snapshot: Unknown) {
      return aggregate.from(snapshot);
    },
    reduce(events: TEventFactory["$events"][number]["$record"][], snapshot?: Unknown) {
      const instance = aggregate.from(snapshot);
      for (const event of events) {
        instance.with(event);
      }
      return instance;
    },
  };
}

/**
 * Make an event reducer that produces a state based on resolved events.
 *
 * @param foldFn  - Method which handles the event reduction.
 * @param stateFn - Default state factory.
 */
export function makeReducer<TEventFactory extends EventFactory, TState extends Unknown>(
  foldFn: ReducerLeftFold<TState, TEventFactory>,
  stateFn: ReducerState<TState>,
): Reducer<TEventFactory, TState> {
  return {
    from(snapshot: TState) {
      return snapshot;
    },
    reduce(events: TEventFactory["$events"][number]["$record"][], snapshot?: TState) {
      return events.reduce(foldFn, snapshot ?? (stateFn() as TState));
    },
  };
}

export type Reducer<TEventFactory extends EventFactory = EventFactory, TState extends Record<string, unknown> | AggregateRoot<TEventFactory> = any> = {
  /**
   * Return result directly from a snapshot that does not have any subsequent
   * events to fold onto a state.
   *
   * @param snapshot - Snapshot of a reducer state.
   */
  from(snapshot: Unknown): TState;

  /**
   * Take in a list of events, and return a state from the given events.
   *
   * @param events   - Events to reduce.
   * @param snapshot - Initial snapshot state to apply to the reducer.
   */
  reduce(events: TEventFactory["$events"][number]["$record"][], snapshot?: Unknown): TState;
};

/**
 * Take an event, and fold it onto the given state.
 *
 * @param state - State to fold onto.
 * @param event - Event to fold from.
 *
 * @example
 * ```ts
 * const events = [...events];
 * const state = events.reduce((state, event) => {
 *   state.foo = event.data.foo;
 *   return state;
 * }, {
 *   foo: ""
 * })
 * ```
 */
export type ReducerLeftFold<TState extends Record<string, unknown> = any, TEventFactory extends EventFactory = EventFactory> = (
  state: TState,
  event: TEventFactory["$events"][number]["$record"],
) => TState;

export type ReducerState<TState extends Unknown> = () => TState;

export type InferReducerState<TReducer> = TReducer extends Reducer<infer _, infer TState> ? TState : never;
