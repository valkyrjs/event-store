import type { EventRecord } from "./event.ts";

export type ProjectorListeners<R extends EventRecord = EventRecord> = Record<
  string,
  Set<ProjectorListenerFn<R>> | undefined
>;

export type ProjectorMessage<Record extends EventRecord = EventRecord> = {
  record: Record;
  state: ProjectionState;
};

export type ProjectorListenerFn<Record extends EventRecord = EventRecord> = (
  record: Record,
  state: ProjectionState,
) => void;

export type ProjectionHandler<Record extends EventRecord = EventRecord> = (record: Record) => Promise<void>;

export type ProjectionState = {
  /**
   * Has the event run through projections previously. In which case we do
   * not want to re-run one time projections that should not execute during
   * replay events.
   */
  hydrated: boolean;

  /**
   * Is the incoming event older than another event of the same type in
   * the same stream.
   */
  outdated: boolean;
};

export type ProjectionFilter = {
  /**
   * Hydrated events represents events that are not seen for the first time
   * in the entirety of its lifetime across all distributed instances.
   */
  allowHydratedEvents: boolean;

  /**
   * Outdated events represents events that have already seen the same type
   * at a later occurrence. Eg. If incoming event is older than the latest
   * local event of the same type, it is considered outdated.
   */
  allowOutdatedEvents: boolean;
};
