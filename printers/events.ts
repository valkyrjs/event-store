import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { resolveRefs } from "json-refs";
import { jsonSchemaToZod } from "json-schema-to-zod";
import { format } from "prettier";

import { assertEventConfig, type EventConfig } from "./asserts/events.ts";
import { jsonSchema } from "./utilities/json-schema.ts";

/**
 * Consumes a list of *.json files stored under given paths and generates a new
 * events file ready for consumption by an event store instance.
 *
 * @example
 *
 * ```ts
 * import { printEvents } from "@valkyr/event-store";
 *
 * await printEvents({
 *   paths: ["path/to/events-1", "path/to/events-2"]
 *   output: "path/to/events.ts"
 * });
 * ```
 *
 * @param options.paths   - Paths containing *.json event configuration files.
 * @param options.output  - Target file to generate the events to.
 * @param options.modules - List of modules to print events for.
 */
export async function printEvents({ paths, output, modules = [] }: Options) {
  const { names, types, validators } = await getEventStoreContainer(paths, [
    ...modules.map((module) => module.events).flat(),
  ]);
  await writeFile(
    output,
    await format(
      `
        /* eslint-disable @typescript-eslint/no-unused-vars */
        // This is an auto generated file. Do not modify this file!
        
        import { type AnyZodObject, type Empty, type Event, z } from "@valkyr/event-store";
    
        export const events = new Set([${names.map((event) => `"${event}"`).join(",")}] as const);

        export const validators = new Map<${names.map((name) => `"${name}"`).join(" | ")}, AnyZodObject>([
          ${Array.from(validators.entries()).map(([key, value]) => `["${key}", ${value}]`).join(",")}
        ]);

        export type Events = ${names.join(" | ")};

        ${types.join("\n\n")}
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

  const events = [...(await getEvents(paths)), ...getModuleEvents(module)];
  for (const event of events) {
    const type = event.type;
    container.names.push(type);
    container.types.push(getEventType(event));
    if (event.data !== undefined) {
      container.props.add({ name: type, props: jsonSchema.propertyNames(event.data) });
    }
    container.validators.set(type, await getEventValidator(type, event.data ?? {}));
  }

  container.imports = getImports(events);

  return container;
}

async function getEvents(paths: string[]): Promise<EventConfig[]> {
  const events: EventConfig[] = [];
  for (const path of paths) {
    for (const eventPath of await readdir(path)) {
      const event = JSON.parse(new TextDecoder().decode(await readFile(join(path, eventPath))));
      assertEventConfig(event);
      events.push(event);
    }
  }
  return events;
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

function getModuleEvents(events: any[]): EventConfig[] {
  for (const event of events) {
    assertEventConfig(event);
  }
  return events;
}

function getEventType(event: EventConfig) {
  let data = "Empty";
  if (event.data !== undefined) {
    data = jsonSchema.compile({
      type: "object",
      properties: event.data,
    });
  }
  let meta = "Empty";
  if (event.meta !== undefined) {
    meta = jsonSchema.compile({
      type: "object",
      properties: event.meta,
    });
  }
  return `export type ${event.type} = Event<"${event.type}", ${data}, ${meta}>;`;
}

function getImports(items: any[]) {
  const imports: any = {};
  for (const item of items) {
    for (const key in item.imports ?? {}) {
      if (imports[key] === undefined) {
        imports[key] = new Set<string>();
      }
      item.imports[key].forEach((value: string) => imports[key].add(value));
    }
  }
  const output: string[] = [];
  for (const key in imports) {
    output.push(`import type { ${Array.from(imports[key]).join(", ")} } from "${key}";`);
  }
  return output;
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
