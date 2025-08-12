import z, { ZodType } from "zod";

import { EventValidationError } from "./errors.ts";
import { getLogicalTimestamp } from "./time.ts";
import { toPrettyErrorLines } from "./zod.ts";

export class Event<TEventState extends EventState = EventState> {
  declare readonly $record: EventRecord<TEventState>;
  declare readonly $payload: EventPayload<TEventState>;

  constructor(readonly state: TEventState) {}

  /**
   * Stores the recorded partial piece of data that makes up a larger aggregate
   * state.
   *
   * @param data - Schema used to parse and infer the data supported by the event.
   */
  data<TData extends ZodType>(data: TData): Event<Omit<TEventState, "data"> & { data: TData }> {
    return new Event<Omit<TEventState, "data"> & { data: TData }>({ ...this.state, data });
  }

  /**
   * Stores additional meta data about the event that is not directly related
   * to the aggregate state.
   *
   * @param meta - Schema used to parse and infer the meta supported by the event.
   */
  meta<TMeta extends ZodType>(meta: TMeta): Event<Omit<TEventState, "meta"> & { meta: TMeta }> {
    return new Event<Omit<TEventState, "meta"> & { meta: TMeta }>({ ...this.state, meta });
  }

  /**
   * Creates an event record by combining the given event with additional metadata.
   * The resulting record can be stored in an event store.
   *
   * @param payload - The event to record.
   */
  record(payload: EventPayload<TEventState>): EventRecord<TEventState> {
    const timestamp = getLogicalTimestamp();

    const record = {
      id: crypto.randomUUID(),
      stream: payload.stream ?? crypto.randomUUID(),
      type: this.state.type,
      data: "data" in payload ? payload.data : null,
      meta: "meta" in payload ? payload.meta : null,
      created: timestamp,
      recorded: timestamp,
    } as any;

    const validation = this.validate(record);
    if (validation.success === false) {
      throw new EventValidationError(record, validation.errors);
    }

    return record;
  }

  /**
   * Takes an event record and validates it against the event.
   *
   * @param record - Record to validate.
   */
  validate(record: EventRecord<TEventState>): EventValidationResult {
    const errors = [];

    if (record.type !== this.state.type) {
      errors.push(`✖ Event record '${record.type}' does not belong to '${this.state.type}' event.`);
    }

    if (record.data !== null) {
      if (this.state.data === undefined) {
        errors.push(`✖ Event record '${record.type}' does not have a 'data' validator.`);
      } else {
        const result = this.state.data.safeParse(record.data);
        if (result.success === false) {
          errors.push(toPrettyErrorLines(result.error));
        }
      }
    }

    if (record.meta !== null) {
      if (this.state.meta === undefined) {
        errors.push(`✖ Event record '${record.type}' does not have a 'meta' validator.`);
      } else {
        const result = this.state.meta.safeParse(record.meta);
        if (result.success === false) {
          errors.push(toPrettyErrorLines(result.error));
        }
      }
    }

    if (errors.length !== 0) {
      return { success: false, errors };
    }
    return { success: true };
  }
}

export const event: {
  type<const TType extends string>(type: TType): Event<{ type: TType }>;
} = {
  type<const TType extends string>(type: TType): Event<{ type: TType }> {
    return new Event<{ type: TType }>({ type });
  },
};

type EventState = {
  type: string;
  data?: ZodType;
  meta?: ZodType;
};

export type EventPayload<TEventState extends EventState> = { stream?: string } & (TEventState["data"] extends ZodType
  ? { data: z.infer<TEventState["data"]> }
  : object) &
  (TEventState["meta"] extends ZodType ? { meta: z.infer<TEventState["meta"]> } : object);

type EventValidationResult =
  | {
      success: true;
    }
  | {
      success: false;
      errors: any[];
    };

/**
 * Event that has been persisted to a event store solution.
 */
export type EventRecord<TEvent extends EventState = EventState> = {
  /**
   * A unique event identifier.
   */
  id: UUID;

  /**
   * Event streams are used to group related events together. This identifier
   * is used to identify the stream to which the event belongs.
   */
  stream: UUID;

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
  data: TEvent["data"] extends ZodType ? z.infer<TEvent["data"]> : null;

  /**
   * Key holding meta data that is not directly tied to read models or used
   * in aggregate states.
   */
  meta: TEvent["meta"] extends ZodType ? z.infer<TEvent["meta"]> : null;

  /**
   * An immutable hybrid logical clock timestamp representing the wall time when
   * the event was created.
   *
   * This value is used to identify the date of its creation as well as a sorting
   * key when performing reduction logic to generate aggregate state for the
   * stream in which the event belongs.
   */
  created: string;

  /**
   * A mutable hybrid logical clock timestamp representing the wall time when the
   * event was recorded to the local **event ledger** _(database)_ as opposed to
   * when the event was actually created.
   *
   * This value is used when performing event synchronization between two
   * different event ledgers.
   */
  recorded: string;
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

export type UUID = `${string}-${string}-${string}-${string}-${string}`;
