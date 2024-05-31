import { nanoid } from "nanoid";

import type { Event, EventFactory, EventRecord } from "../types/event.ts";

/**
 * Creates an event factory function for a given event type.
 * The factory function can be used to create instances of the event type
 * with the specified data and metadata.
 *
 * @param type The type of event to create.
 */
export function makeEvent<E extends Event>(type: E["type"]): EventFactory<E> {
  return (data: E["data"] = {}, meta: E["meta"] = {}) => ({ type, data, meta }) as E;
}

/**
 * Creates an event record by combining the given event with additional metadata.
 * The resulting record can be stored in an event store.
 *
 * @param event - The event to record.
 */
export function createEventRecord<E extends Event>(
  event: E & {
    stream?: string;
  },
): EventRecord<E> {
  const timestamp = Date.now();
  if (event.stream === undefined) {
    delete event.stream;
  }
  return {
    id: nanoid(11),
    stream: nanoid(11),
    ...event,
    created: timestamp,
    recorded: timestamp,
  };
}
