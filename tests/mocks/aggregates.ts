import { AggregateRoot } from "../../libraries/aggregate.ts";
import { Events } from "./events.ts";

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
