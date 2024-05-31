import { join } from "node:path";

import { assertEquals } from "std/assert/mod.ts";
import { afterAll, describe, it } from "std/testing/bdd.ts";

import { printEvents } from "../../mod.ts";

describe("Events Printer", () => {
  const temp = join(import.meta.dirname!, "_temp");
  const output = join(temp, "events.ts");

  afterAll(async () => {
    await Deno.remove(output);
  });

  it("should create a new events.ts file", async () => {
    await printEvents({
      paths: [join(import.meta.dirname!, "events")],
      output,
    });

    for await (const entity of Deno.readDir(temp)) {
      assertEquals(entity.isFile, true);
    }
  });
});
