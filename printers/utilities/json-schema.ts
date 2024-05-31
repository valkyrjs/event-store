import type { JSONSchema4, JSONSchema4Type } from "json-schema";

export const jsonSchema = {
  compile,
  propertyNames,
};

function compile(schema: JSONSchema4): string {
  switch (schema.type) {
    case "object": {
      if (schema.properties === undefined) {
        throw new Error("Missing properties in schema object");
      }
      const properties: string[] = [];
      for (const property in schema.properties) {
        properties.push(`${property}: ${compile(schema.properties[property])}`);
      }
      return `{ ${properties.join("\n")} }`;
    }
    case "array": {
      if (schema.items === undefined) {
        throw new Error("Missing items in schema array");
      }
      if (Array.isArray(schema.items) === true) {
        const types: string[] = [];
        for (const item of schema.items) {
          types.push(compile(item));
        }
        return `[${types.join(", ")}]`;
      }
      return `${compile(schema.items)}[]`;
    }
    default: {
      if (schema.enum !== undefined) {
        return compileEnum(schema.enum);
      }
      if (typeof schema.type === "string") {
        return schema.type;
      }
      return "unknown";
    }
  }
}

function compileEnum(types: JSONSchema4Type[]): string {
  const values: string[] = [];
  for (const type of types) {
    if (Array.isArray(type) === true) {
      values.push(`(${compileEnum(type)})[]`);
    } else {
      values.push(JSON.stringify(type));
    }
  }
  return values.join(" | ");
}

function propertyNames(properties: any): string[] {
  return Object.keys(properties);
}
