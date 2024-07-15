import type { EventStore } from "~types/event-store.ts";

import type { UserEvent, UserEventRecord } from "./events.ts";

export function getUserReducer(store: EventStore<UserEvent, UserEventRecord>) {
  return store.reducer<UserState>((state, event) => {
    switch (event.type) {
      case "UserCreated": {
        state.name.given = event.data.name.given;
        state.name.family = event.data.name.family;
        state.email = event.data.email;
        break;
      }
      case "UserGivenNameSet": {
        state.name.given = event.data.given;
        break;
      }
      case "UserFamilyNameSet": {
        state.name.family = event.data.family;
        break;
      }
      case "UserEmailSet": {
        state.email = event.data.email;
        break;
      }
      case "UserDeactivated": {
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
