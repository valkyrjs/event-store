import { Ajv } from "ajv";
import type { JSONSchema4 } from "json-schema";

class EventConfigAssertionError extends Error {
  constructor(message: string, readonly error?: unknown) {
    super(`Event Config Assertion Error: ${message}`);
  }
}

export function assertEventConfigs(configs: any[]): asserts configs is EventConfig[] {
  for (const config of configs) {
    assertEventConfig(config);
  }
}

export function assertEventConfig(config: any): asserts config is EventConfig {
  if (config.type === undefined) {
    throw new EventConfigAssertionError("Missing required 'type' key");
  }
  if (config.data) {
    try {
      new Ajv().addSchema({
        type: "object",
        properties: config.data,
      });
    } catch (error) {
      throw new EventConfigAssertionError("Invalid 'data' provided, must be valid JSONSchema", error);
    }
  }
  if (config.meta) {
    try {
      new Ajv().addSchema({
        type: "object",
        properties: config.meta,
      });
    } catch (error) {
      throw new EventConfigAssertionError("Invalid 'meta' provided, must be valid JSONSchema", error);
    }
  }
}

export type EventConfig = {
  type: string;
  data?: JSONSchemaProperties;
  meta?: JSONSchemaProperties;
};

type JSONSchemaProperties = {
  [key: string]: JSONSchema4;
};
