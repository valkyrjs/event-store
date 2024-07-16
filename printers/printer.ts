import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { resolveRefs } from "json-refs";
import { jsonSchemaToZod } from "json-schema-to-zod";
import { pascalcase } from "pascalcase";
import { format } from "prettier";

import { ensureDir } from "../utilities/fs.ts";
import { assertConfig, type Config } from "./asserts/events.ts";
import { getEventType, getImports } from "./types.ts";
import { jsonSchema } from "./utilities/json-schema.ts";

/**
 * Consumes a list of *.json files stored under given paths and generates a new
 * events file ready for consumption by an event store instance.
 *
 * @param options.paths   - Paths containing *.json event configuration files.
 * @param options.output  - Target file to generate the events to.
 * @param options.modules - List of modules to print events for.
 *
 * @example
 *
 * ```ts
 * import { printEvents } from "@valkyr/event-store";
 *
 * await printEvents({
 *   paths: [
 *    "path/to/events-1",
 *    "path/to/events-2"
 *   ],
 *   output: "path/to/events.ts",
 * });
 * ```
 */
export async function printEvents({ paths, output, modules = [] }: Options) {
  const { names, types, validators } = await getEventStoreContainer(paths, [
    ...modules.map((module) => module.events).flat(),
  ]);
  await ensureDir(output);
  await writeFile(
    output,
    await format(
      `
        /* eslint-disable @typescript-eslint/no-unused-vars */
        // deno-fmt-ignore-file
        // This is an auto generated file. Do not modify this file!
        
        import { type AnyZodObject, type Empty, type Event, type EventToRecord, z } from "@valkyr/event-store";
    
        export const events = new Set([${names.sort().map((event) => `"${event}"`).join(",")}] as const);

        export const validators = new Map<SystemEvent["type"], AnyZodObject>([
          ${
        Array.from(validators.entries()).sort(([a], [b]) => a > b ? 1 : -1).map(([key, value]) =>
          `["${key}", ${value}]`
        ).join(",")
      }
        ]);

        export type SystemEventRecord = EventToRecord<SystemEvent>;

        export type SystemEvent = ${names.sort().map((name) => pascalcase(name)).join(" | ")};

        ${types.sort().join("\n\n")}
      `,
      {
        parser: "typescript",
        printWidth: 120,
      },
    ),
  );
}

/*
 |--------------------------------------------------------------------------------
 | Utilities
 |--------------------------------------------------------------------------------
 */

async function getEventStoreContainer(
  paths: string[],
  module: any[] = [],
): Promise<EventStoreContainer> {
  const container: EventStoreContainer = {
    names: [],
    types: [],
    props: new Set(),
    validators: new Map<string, any>(),
    imports: [],
  };

  const configs = [...(await getLocalConfigs(paths)), ...getModuleConfigs(module)];
  for (const { event } of configs) {
    const type = event.type;
    container.names.push(type);
    container.types.push(getEventType(event));
    if (event.data !== undefined) {
      container.props.add({ name: type, props: jsonSchema.propertyNames(event.data) });
      container.validators.set(type, await getEventValidator(type, event.data));
    }
  }

  container.imports = getImports(configs);

  return container;
}

async function getLocalConfigs(paths: string[]): Promise<Config[]> {
  const events: Config[] = [];
  for (const path of paths) {
    for (const eventPath of await readdir(path)) {
      const config = JSON.parse(new TextDecoder().decode(await readFile(join(path, eventPath))));
      assertConfig(config);
      events.push(config);
    }
  }
  return events;
}

function getModuleConfigs(configs: any[]): Config[] {
  for (const config of configs) {
    assertConfig(config);
  }
  return configs;
}

async function getEventValidator(name: string, data: any) {
  const schema = {
    $schema: "http://json-schema.org/draft-04/schema#",
    id: `valkyrjs/schemas/v1/${name}.json`,
    title: name,
    type: "object",
    properties: populateProperties(data),
    required: Object.keys(data),
    additionalProperties: false,
  };
  const { resolved } = await resolveRefs(schema);
  return jsonSchemaToZod(resolved);
}

function populateProperties(props: any) {
  for (const key in props) {
    const prop = props[key];
    if (prop.type === "object") {
      prop.required = Object.keys(prop.properties);
      prop.additionalProperties = false;
    }
  }
  return props;
}

/*
 |--------------------------------------------------------------------------------
 | Types
 |--------------------------------------------------------------------------------
 */

/**
 * Options bag to pass to the {@link printEvents} method.
 */
type Options = {
  /**
   * Absolute paths to the folders the event configuration files is stored.
   *
   * @example
   *
   * ```ts
   * await printEvents({
   *   paths: ["path/to/events-1", "path/to/events-2"]
   *   output: "path/to/events.ts",
   *   modules: []
   * });
   * ```
   */
  paths: string[];

  /**
   * List of modules that provides their own events to be included in the output.
   *
   * @example
   *
   * ```ts
   * import { foo } from "foo"; // valkyr compliant module
   *
   * await printEvents({
   *   paths: ["path/to/events-1", "path/to/events-2"]
   *   output: "path/to/events.ts",
   *   modules: [foo]
   * });
   * ```
   */
  modules?: {
    events: any[];
  }[];

  /**
   * Absolute path to the folder the generated events should be written.
   *
   * @example
   *
   * ```ts
   * await printEvents({
   *   paths: ["path/to/events-1", "path/to/events-2"]
   *   output: "path/to/events.ts",
   *   modules: []
   * });
   * ```
   */
  output: string;
};

type EventStoreContainer = {
  names: string[];
  types: string[];
  props: Set<{ name: string; props: string[] }>;
  validators: Map<string, any>;
  imports: string[];
};
