import { join } from "node:path";

import { assertArrayIncludes } from "std/assert/mod.ts";
import { afterAll, describe, it } from "std/testing/bdd.ts";

import { printEvents } from "../../mod.ts";

describe("Events Printer", () => {
  const temp = join(import.meta.dirname!, "_temp");
  const output = join(temp, "events.ts");

  afterAll(async () => {
    await Deno.remove(temp, { recursive: true });
  });

  it("should create a new events.ts file", async () => {
    await printEvents({
      paths: [join(import.meta.dirname!, "mocks", "events")],
      output,
    });

    const { events, validators } = await import(output);

    assertArrayIncludes(Array.from(events), [
      "user:activated",
      "user:created",
      "user:deactivated",
      "user:email_set",
      "user:family_name_set",
      "user:given_name_set",
    ]);

    assertArrayIncludes(Array.from(validators.data.keys()), [
      "user:created",
      "user:email_set",
      "user:family_name_set",
      "user:given_name_set",
    ]);

    assertArrayIncludes(Array.from(validators.meta.keys()), [
      "user:activated",
      "user:email_set",
    ]);
  });
});
