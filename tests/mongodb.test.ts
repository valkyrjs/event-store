import { afterAll, afterEach, beforeAll, describe } from "@std/testing/bdd";
import { MongoTestContainer } from "@valkyr/testcontainers/mongodb";

import { MongoAdapter, register } from "../adapters/mongo/adapter.ts";
import { EventStore, EventStoreHooks } from "../libraries/event-store.ts";
import { Projector } from "../libraries/projector.ts";
import { aggregates } from "./mocks/aggregates.ts";
import { events, EventStoreFactory } from "./mocks/events.ts";
import testAddEvent from "./store/add-event.ts";
import testAddManyEvents from "./store/add-many-events.ts";
import testCreateSnapshot from "./store/create-snapshot.ts";
import testMakeAggregateReducer from "./store/make-aggregate-reducer.ts";
import testMakeEvent from "./store/make-event.ts";
import testMakeReducer from "./store/make-reducer.ts";
import testOnceProjection from "./store/once-projection.ts";
import testRelationsProvider from "./store/providers/relations.ts";
import testPushAggregate from "./store/push-aggregate.ts";
import testPushManyAggregates from "./store/push-many-aggregates.ts";
import testReduce from "./store/reduce.ts";
import testReplayEvents from "./store/replay-events.ts";

const DB_NAME = "sandbox";

const container = await MongoTestContainer.start();

const eventStoreFn = async (options: { hooks?: EventStoreHooks<EventStoreFactory> } = {}) => getEventStore(options);

/*
 |--------------------------------------------------------------------------------
 | Database
 |--------------------------------------------------------------------------------
 */

beforeAll(async () => {
  const db = container.client.db(DB_NAME);
  await register(db, console.info);
});

afterEach(async () => {
  const db = container.client.db(DB_NAME);
  await Promise.all([db.collection("events").deleteMany({}), db.collection("relations").deleteMany({}), db.collection("snapshots").deleteMany({})]);
});

afterAll(async () => {
  await container.stop();
});

/*
 |--------------------------------------------------------------------------------
 | Tests
 |--------------------------------------------------------------------------------
 */

describe("Adapter > MongoDb", () => {
  testRelationsProvider(eventStoreFn);
  testAddEvent(eventStoreFn);
  testAddManyEvents(eventStoreFn);
  testCreateSnapshot(eventStoreFn);
  testMakeEvent(eventStoreFn);
  testMakeReducer(eventStoreFn);
  testMakeAggregateReducer(eventStoreFn);
  testReplayEvents(eventStoreFn);
  testReduce(eventStoreFn);
  testOnceProjection(eventStoreFn);

  testPushAggregate(eventStoreFn);
  testPushManyAggregates(eventStoreFn);
});

/*
 |--------------------------------------------------------------------------------
 | Utilities
 |--------------------------------------------------------------------------------
 */

async function getEventStore({ hooks = {} }: { hooks?: EventStoreHooks<EventStoreFactory> }) {
  const store = new EventStore({
    adapter: new MongoAdapter(() => container.client, DB_NAME),
    events,
    aggregates,
    hooks,
  });

  const projector = new Projector<EventStoreFactory>();

  if (hooks.onEventsInserted === undefined) {
    store.onEventsInserted(async (records, { batch }) => {
      if (batch !== undefined) {
        await projector.pushMany(batch, records);
      } else {
        for (const record of records) {
          await projector.push(record, { hydrated: false, outdated: false });
        }
      }
    });
  }

  return { store, projector };
}
