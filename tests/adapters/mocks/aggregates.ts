import { AggregateRoot } from "../../../libraries/aggregate.ts";
import { AggregateFactory } from "../../../libraries/aggregate-factory.ts";
import { makeId } from "../../../libraries/nanoid.ts";
import { makeAggregateReducer } from "../../../libraries/reducer.ts";
import { EventStoreFactory } from "./events.ts";

export class User extends AggregateRoot<EventStoreFactory> {
  static override readonly name = "user";

  id: string = "";
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
  // Factories
  // -------------------------------------------------------------------------

  static reducer = makeAggregateReducer(User);

  static create(name: Name, email: string): User {
    const user = new User();
    user.push({
      type: "user:created",
      stream: makeId(),
      data: { name, email },
      meta: { auditor: "foo" },
    });
    return user;
  }

  static async getById(userId: string): Promise<User | undefined> {
    return this.$store.reduce({ name: "user", stream: userId, reducer: this.reducer });
  }

  // -------------------------------------------------------------------------
  // Reducer
  // -------------------------------------------------------------------------

  with(event: EventStoreFactory["$events"][number]["$record"]) {
    switch (event.type) {
      case "user:created": {
        this.id = event.stream;
        this.name.given = event.data.name?.given ?? "";
        this.name.family = event.data.name?.family ?? "";
        this.email = event.data.email;
        break;
      }
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

  async snapshot(): Promise<this> {
    await this.$store.createSnapshot({ name: "user", stream: this.id, reducer: User.reducer });
    return this;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  fullName(): string {
    return `${this.name.given} ${this.name.family}`;
  }
}

export const aggregates = new AggregateFactory([User]);

type Name = {
  given: string;
  family: string;
};

type UserPosts = {
  list: string[];
  count: number;
};
