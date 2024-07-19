import type { Collection } from "@valkyr/db";

import type { Context } from "~types/context.ts";

export class ContextsProvider {
  constructor(readonly contexts: Collection<{ key: string; stream: string }>) {}

  /**
   * Handle incoming context operations.
   *
   * @param contexts - List of context operations to execute.
   */
  async handle(contexts: Context[]): Promise<void> {
    for (const context of contexts) {
      if (context.op === "insert") {
        await this.insert(context.key, context.stream);
      }
      if (context.op === "remove") {
        await this.remove(context.key, context.stream);
      }
    }
  }

  /**
   * Add stream to a context.
   *
   * @param key    - Context key to add stream to.
   * @param stream - Stream to add to the context.
   */
  async insert(key: string, stream: string): Promise<void> {
    await this.contexts.insertOne({ key, stream });
  }

  /**
   * Get a list of event streams registered under the given context key.
   *
   * @param key - Context key to get event streams for.
   */
  async getByKey(key: string): Promise<{ stream: string; key: string }[]> {
    return this.contexts.find({ key });
  }

  /**
   * Removes a stream form a context.
   *
   * @param key    - Context key to remove stream from.
   * @param stream - Stream to remove from context.
   */
  async remove(key: string, stream: string): Promise<void> {
    await this.contexts.remove({ key, stream });
  }
}
