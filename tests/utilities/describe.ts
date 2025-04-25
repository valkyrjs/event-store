import { describe as desc } from "@std/testing/bdd";

import { EventFactory } from "../../libraries/event-factory.ts";
import { EventStore, type EventStoreHooks } from "../../libraries/event-store.ts";
import { Projector } from "../../libraries/projector.ts";

export function describe<TEventFactory extends EventFactory>(
  name: string,
  runner: (getEventStore: EventStoreFn<TEventFactory>) => void,
): (getEventStore: EventStoreFn<TEventFactory>) => void {
  return (getEventStore: EventStoreFn<TEventFactory>) => desc(name, () => runner(getEventStore));
}

type EventStoreFn<TEventFactory extends EventFactory> = (options?: { hooks?: EventStoreHooks<TEventFactory> }) => Promise<{
  store: EventStore<TEventFactory, any, any>;
  projector: Projector<TEventFactory>;
}>;
