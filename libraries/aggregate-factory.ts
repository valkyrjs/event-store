import { AggregateRootClass } from "./aggregate.ts";
import { EventFactory } from "./event-factory.ts";
import { AnyEventStore } from "./event-store.ts";

/**
 * Indexes a list of event factories for use with aggregates and event stores
 * when generating or accessing event functionality.
 *
 * @example
 *
 * ```ts
 * import { AggregateRoot, AggregateFactory } from "@valkyr/event-store";
 * import z from "zod";
 *
 * class User extends AggregateRoot {}
 *
 * const factory = new AggregateFactory([User]);
 *
 * export type Aggregates = typeof factory.$aggregates;
 * ```
 */
export class AggregateFactory<
  const TEventFactory extends EventFactory = EventFactory,
  const TAggregates extends AggregateRootClass<TEventFactory>[] = AggregateRootClass<TEventFactory>[],
> {
  /**
   * Optimized aggregate lookup index.
   */
  readonly #index = new Map<TAggregates[number]["name"], TAggregates[number]>();

  aggregates: TAggregates;

  /**
   * Inferred type of the aggregates registered with the factory.
   */
  declare readonly $aggregates: TAggregates;

  /**
   * Instantiate a new AggregateFactory with given list of supported aggregates.
   *
   * @param aggregates - Aggregates to register with the factory.
   */
  constructor(aggregates: TAggregates) {
    this.aggregates = aggregates;
    for (const aggregate of aggregates) {
      this.#index.set(aggregate.name, aggregate);
    }
  }

  /**
   * Attaches the given store to all the aggregates registered with this instance.
   *
   * If the factory is passed into multiple event stores, the aggregates will be
   * overriden by the last execution. Its recommended to create individual instances
   * for each list of aggregates.
   *
   * @param store - Event store to attach to the aggregates.
   */
  withStore(store: AnyEventStore): this {
    for (const aggregate of this.aggregates) {
      aggregate.$store = store;
    }
    return this;
  }

  /**
   * Get a registered aggregate from the factory.
   *
   * @param name - Aggregate to retrieve.
   */
  get<TName extends TAggregates[number]["name"]>(name: TName): Extract<TAggregates[number], { name: TName }> {
    return this.#index.get(name) as Extract<TAggregates[number], { name: TName }>;
  }
}
