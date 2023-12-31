import { createEventRecord } from "../src/Event/Record.js";
import { events, reducer } from "./Event.Mock.js";

/*
 |--------------------------------------------------------------------------------
 | Data
 |--------------------------------------------------------------------------------
 */

const containerId = "abc";
const streamId = "xyz";

const records = [
  createEventRecord(containerId, streamId, events.created({ title: "Bar" })),
  createEventRecord(containerId, streamId, events.member.added({ name: "John Foo" })),
  createEventRecord(containerId, streamId, events.member.added({ name: "Jane Foo" }))
];

/*
 |--------------------------------------------------------------------------------
 | Tests
 |--------------------------------------------------------------------------------
 |
 | A reducer takes a stream of events and reduces it down to a single state
 | representing said stream as a finalized whole.
 |
 */

describe("Reducer", () => {
  it("should successfully reduce to expected state", async () => {
    const state = reducer(records);
    expect(state).toEqual({
      title: "Bar",
      members: ["John Foo", "Jane Foo"]
    });
  });
});
