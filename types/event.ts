import type { Empty } from "./common.ts";

/*
 |--------------------------------------------------------------------------------
 | Factory
 |--------------------------------------------------------------------------------
 */

/**
 * Event factory that defines the required input based on the event it is
 * representing.
 */
export type EventFactory<TEvent extends Event> = TEvent["meta"] extends Empty
  ? TEvent["data"] extends Empty ? () => TEvent
  : (data: TEvent["data"]) => TEvent
  : TEvent["data"] extends Empty ? (data: Empty, meta: TEvent["meta"]) => TEvent
  : (data: TEvent["data"], meta: TEvent["meta"]) => TEvent;

/*
 |--------------------------------------------------------------------------------
 | Record
 |--------------------------------------------------------------------------------
 */

/**
 * Event wrapped to an EventRecord.
 */
export type EventToRecord<TEvent> = TEvent extends Event ? EventRecord<TEvent> : never;

/**
 * Event that has been persisted to a event store solution.
 */
export type EventRecord<TEvent extends Event = Event> = {
  /**
   * A unique event identifier.
   */
  id: string;

  /**
   * Event streams are used to group related events together. This identifier
   * is used to identify the stream to which the event belongs.
   */
  stream: string;

  /**
   * Type refers to the purpose of the event in a past tense descibing something
   * that has already happened.
   */
  type: TEvent["type"];

  /**
   * Key holding event data that can be used to update one or several read
   * models and used to generate aggregate state for the stream in which the
   * event belongs.
   */
  data: TEvent["data"];

  /**
   * Key holding meta data that is not directly tied to read models or used
   * in aggregate states.
   */
  meta: TEvent["meta"];

  /**
   * An immutable iso timestamp representing the wall time when the event was created.
   *
   * This value is used to identify the date of its creation as well as a sorting
   * key when performing reduction logic to generate aggregate state for the stream
   * in which the event belongs.
   */
  created: number;

  /**
   * A mutable iso timestamps representing the wall time when the event was recorded to
   * the local **event ledger** _(database)_ as opposed to when the event was actually
   * created.
   *
   * This value is used when performing event synchronization between two different
   * event ledgers.
   */
  recorded: number;
};

/**
 * Status of an event and how it relates to other events in the aggregate
 * stream it has been recorded.
 */
export type EventStatus = {
  /**
   * Does the event already exist in the containing stream. This is an
   * optimization flag so that we can potentially ignore the processing of the
   * event if it already exists.
   */
  exists: boolean;

  /**
   * Is there another event in the stream of the same type that is newer than
   * the provided event. This is passed into projectors so that they can
   * route the event to the correct projection handlers.
   *
   * @see {@link Projection [once|on|all]}
   */
  outdated: boolean;
};

/*
 |--------------------------------------------------------------------------------
 | Event
 |--------------------------------------------------------------------------------
 */

/**
 * Event of type representing something that has occured in a system. Contains
 * type, data and meta data which can be persisted to an EventRecord which can
 * be delivered for further utility.
 */
export type Event<Type extends string = string, Data extends EventContent = any, Meta extends EventContent = any> = {
  /**
   * Event identifier describing the intent of the event in a past tense format.
   */
  type: Type;

  /**
   * Stores the recorded partial piece of data that makes up a larger aggregate
   * state.
   */
  data: Data extends EventContent ? Data : Empty;

  /**
   * Stores additional meta data about the event that is not directly related
   * to the aggregate state.
   */
  meta: Meta extends EventContent ? Meta : Empty;
};

/*
 |--------------------------------------------------------------------------------
 | Meta
 |--------------------------------------------------------------------------------
 */

/**
 * Assigned to meta data of events representing an identifier of the source that
 * created the event.
 */
export type EventAuditor = {
  auditor: string;
};

type EventContent = Record<string, unknown>;
