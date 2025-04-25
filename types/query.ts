import type { Reducer } from "../libraries/reducer.ts";

export type ReduceQuery<TReducer extends Reducer> =
  | ({
      /**
       * Name of the reducer, must be a unique identifier as its used by snapshotter
       * to store, and manage state snapshots for event streams.
       */
      name: string;

      /**
       * Stream to fetch events from and pass to the reducer method.
       */
      stream: string;

      /**
       * Reducer method to pass resolved events to.
       */
      reducer: TReducer;

      relation?: never;
    } & EventReadFilter)
  | ({
      /**
       * Name of the reducer, must be a unique identifier as its used by snapshotter
       * to store, and manage state snapshots for event streams.
       */
      name: string;

      /**
       * Relational key resolving streams to fetch events from and pass to the
       * reducer method.
       */
      relation: string;

      /**
       * Reducer method to pass resolved events to.
       */
      reducer: TReducer;

      stream?: never;
    } & EventReadFilter);

export type EventReadOptions = EventReadFilter & {
  /**
   * Fetches events from the specific cursor, which uses the local event
   * records `recorded` timestamp.
   */
  cursor?: string;

  /**
   * Fetch events in ascending or descending order. Default: "asc"
   */
  direction?: 1 | -1 | "asc" | "desc";

  /**
   * Limit the number of events returned.
   */
  limit?: number;
};

export type EventReadFilter = {
  /**
   * Filter options for how events are pulled from the store.
   */
  filter?: {
    /**
     * Only include events in the given types.
     */
    types?: string[];
  };
};
