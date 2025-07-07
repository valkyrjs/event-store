import { Event } from "./event.ts";

/**
 * Indexes a list of event factories for use with aggregates and event stores
 * when generating or accessing event functionality.
 *
 * @example
 *
 * ```ts
 * import { event } from "@valkyr/event-store";
 * import z from "zod";
 *
 * const factory = new EventFactory([
 *   event
 *     .type("user:created")
 *     .data(z.object({ name: z.string(), email: z.email() }))
 *     .meta(z.object({ createdBy: z.string() })),
 * ]);
 *
 * export type Events = typeof factory.$events;
 * ```
 */
export class EventFactory<const TEvents extends Event[] = Event[]> {
  /**
   * Optimized event lookup index.
   */
  readonly #index = new Map<TEvents[number]["state"]["type"], TEvents[number]>();

  /**
   * Inferred type of the events registered with the factory.
   */
  declare readonly $events: TEvents;

  /**
   * Instantiate a new EventFactory with given list of supported events.
   *
   * @param events - Events to register with the factory.
   */
  constructor(readonly events: TEvents) {
    for (const event of events) {
      this.#index.set(event.state.type, event);
    }
  }

  /**
   * Get a registered event from the factory.
   *
   * @param type - Event type to retrieve.
   */
  get<TType extends TEvents[number]["state"]["type"]>(
    type: TType,
  ): Extract<TEvents[number], { state: { type: TType } }> {
    return this.#index.get(type) as Extract<TEvents[number], { state: { type: TType } }>;
  }
}
