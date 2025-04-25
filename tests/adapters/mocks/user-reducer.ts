import { makeReducer } from "../../../libraries/reducer.ts";
import { EventStoreFactory } from "./events.ts";

export const userReducer = makeReducer<EventStoreFactory, UserState>(
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
