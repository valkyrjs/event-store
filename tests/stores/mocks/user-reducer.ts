import type { EventStore } from "~types/event-store.ts";

import type { Event, EventRecord } from "./events.ts";

export function getUserReducer(store: EventStore<Event, EventRecord>) {
  return store.reducer<UserState>((state, event) => {
    switch (event.type) {
      case "user:created": {
        state.name.given = event.data.name.given;
        state.name.family = event.data.name.family;
        state.email = event.data.email;
        break;
      }
      case "user:given_name_set": {
        state.name.given = event.data.given;
        break;
      }
      case "user:family_name_set": {
        state.name.family = event.data.family;
        break;
      }
      case "user:email_set": {
        state.email = event.data.email;
        break;
      }
      case "user:deactivated": {
        state.active = false;
        break;
      }
    }
    return state;
  }, {
    name: {
      given: "",
      family: "",
    },
    email: "",
    active: true,
  });
}

export type UserState = {
  name: {
    given: string;
    family: string;
  };
  email: string;
  active: boolean;
};
