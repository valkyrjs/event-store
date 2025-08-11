<p align="center">
  <img src="https://user-images.githubusercontent.com/1998130/229430454-ca0f2811-d874-4314-b13d-c558de8eec7e.svg" />
</p>

# Event Store

Event store solution written in deno for use in TypeScript projects to manage and distribute events from a central
repository to one or more distibuted services.

## Quick Start

The following provides a quick introduction on how to get started.

### Event Store

Once we have defined our configs and printed our events we create a new event store instance. Currently we have support
for `sqlite`, `postgres`, and `valkyr/db` which all works the same way. So for this example we will use the `sqlite`
store.

- Browser _(TODO)_
- Mongo _(TODO)_
- [Postgres](./adapters/postgres)

### Reducers

Event reducers takes a entity stream and reduces it to a wanted state. This is required when we want to perform write
side business logic on the current state of our streams. Using read stores for this is not ideal as the read side data
may not be up to date.

```ts
import { makeReducer } from "@valkyr/event-store";

import type { Events } from "./events.ts";

export const userReducer = makeReducer<Events, UserState>(
  (state, event) => {
    switch (event.type) {
      case "user:created": {
        state.name.given = event.data.name?.given ?? "";
        state.name.family = event.data.name?.family ?? "";
        state.email = event.data.email;
        break;
      }
      case "user:name:given-set": {
        state.name.given = event.data;
        break;
      }
      case "user:name:family-set": {
        state.name.family = event.data;
        break;
      }
      case "user:email-set": {
        state.email = event.data;
        break;
      }
      case "user:activated": {
        state.active = true;
        break;
      }
      case "user:deactivated": {
        state.active = false;
        break;
      }
    }
    return state;
  },
  () => ({
    name: {
      given: "",
      family: "",
    },
    email: "",
    active: true,
    posts: {
      list: [],
      count: 0,
    },
  }),
);

type UserState = {
  name: {
    given: string;
    family: string;
  };
  email: string;
  active: boolean;
  posts: {
    list: string[];
    count: number;
  };
};
```

### Aggreates

Event aggregates takes a entity stream and reduces it to a wanted state. It works on the same conceptual grounds as
the standard reducer but resolved states using an aggregate instead of folding onto a state object.

The benefit of this is that we can create various helper methods on the aggregate that can help us navigate and
query the aggregated state.

```ts
import { AggregateRoot } from "@valkyr/event-store";

import type { Events } from "./events.ts";

export class User extends AggregateRoot<Events> {
  static override readonly name = "user";

  name: Name = {
    given: "",
    family: "",
  };
  email: string = "";
  active: boolean = true;
  posts: UserPosts = {
    list: [],
    count: 0,
  };

  // -------------------------------------------------------------------------
  // Reducer
  // -------------------------------------------------------------------------

  with(event: Events["$events"][number]["$record"]) {
    switch (event.type) {
      case "user:name:given-set": {
        this.name.given = event.data;
        break;
      }
      case "user:name:family-set": {
        this.name.family = event.data;
        break;
      }
      case "user:email-set": {
        this.email = event.data;
        break;
      }
      case "user:activated": {
        this.active = true;
        break;
      }
      case "user:deactivated": {
        this.active = false;
        break;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  setGivenName(given: string): this {
    return this.push({
      type: "user:name:given-set",
      stream: this.id,
      data: given,
      meta: { auditor: "foo" },
    });
  }

  setFamilyName(family: string): this {
    return this.push({
      type: "user:name:family-set",
      stream: this.id,
      data: family,
      meta: { auditor: "foo" },
    });
  }

  setEmail(email: string, auditor: string): this {
    return this.push({
      type: "user:email-set",
      stream: this.id,
      data: email,
      meta: { auditor },
    });
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  fullName(): string {
    return `${this.name.given} ${this.name.family}`;
  }
}

type Name = {
  given: string;
  family: string;
};

type UserPosts = {
  list: string[];
  count: number;
};
```

### Projectors

Projectors serves as a bridge between the write side and read side of your application. Think of them as event handlers
that listens for an event and creates new read side records by pushing that data to one or more data stores or apis
which is queried by your users.

A projector is registered for a specific event type, and can have multiple handlers. They also come with three different
types of listeners, `once`, `on`, and `all`.

```ts
import { Projector } from "@valkyr/event-store";

import store from "./event-store.ts";
import type { Events } from "./events.ts";

const projector = new Projector<Events>();

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

projector.on("event", async (record) => {
  // handle event
});
```

### Hydration in Event Processing

When handling events in a distributed system or during event replay operations, it is important to differentiate between **new events** and **rehydrated events**.

- **New Events (`hydrate: false`)**: These events are being processed for the first time. They will trigger all projection handlers, including `.once()`, `.on()`, and `.all()`.
- **Rehydrated Events (`hydrate: true`)**: These events are being replayed, either as part of a stream synchronization, system recovery, or reprocessing in a distributed environment. They **will not trigger** `.once()` handlers to avoid redundant side effects but will still be processed by `.on()` and `.all()` handlers where applicable.

This mechanism ensures that critical one-time operations (such as sending emails or initiating external API calls) are **not repeated** unnecessarily while still allowing stateful projections to update their read models correctly.

#### `.once("user:created", (event) => Promise<void>)`

This handler tells the projection that an event is only ever processed when the event is originating directly from the
local event store. A useful pattern for when you want the event handler to submit data to a third party service such as
sending an email or submitting third party orders. We disallow `hydrate` and `outdated` as these events represents
events that has already been processed.

#### `.on("user:created", (event) => Promise<void>)`

This method tells the projection to allow events directly from the event store as well as events coming through
hydration via sync, manual or automatic stream rehydration operations. This is the default pattern used for most events.
This is where you usually project the latest data to your read side models and data stores.

We allow `hydrate` as they serve to keep the read side up to date with the latest events.

We disallow `outdated` as we do not want the latest data to be overridden by outdated ones.

NOTE! The nature of this pattern means that outdated events are never run by this projection. Make sure to handle
`outdated` events if you have processing requirements that needs to know about every unknown events that has occurred in
the event stream.

#### `.all("user:created", (event) => Promise<void>)`

This method is a catch all for events that does not fall under the stricter definitions of once and on patterns. This is
a good place to deal with data that does not depend on a strict order of events.
