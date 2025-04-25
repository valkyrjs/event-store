import type { Collection } from "mongodb";

import { SnapshotsProvider } from "../../../types/adapter.ts";
import { schema, type SnapshotSchema } from "../collections/snapshots.ts";
import { DatabaseAccessor } from "../types.ts";
import { toParsedRecord } from "../utilities.ts";

export class MongoSnapshotsProvider implements SnapshotsProvider {
  readonly #accessor: DatabaseAccessor;

  constructor(accessor: DatabaseAccessor) {
    this.#accessor = accessor;
  }

  get collection(): Collection<SnapshotSchema> {
    return this.#accessor.db.collection<SnapshotSchema>("snapshots");
  }

  /**
   * Add snapshot state under given reducer stream.
   *
   * @param name   - Name of the reducer the snapshot is attached to.
   * @param stream - Stream the snapshot is attached to.
   * @param cursor - Cursor timestamp for the last event used in the snapshot.
   * @param state  - State of the reduced events.
   */
  async insert(name: string, stream: string, cursor: string, state: Record<string, unknown>): Promise<void> {
    await this.collection.updateOne({ name }, { $set: { stream, cursor, state } }, { upsert: true });
  }

  /**
   * Get snapshot state by stream.
   *
   * @param name   - Name of the reducer which the state was created.
   * @param stream - Stream the state was reduced for.
   */
  async getByStream(name: string, stream: string): Promise<SnapshotSchema | undefined> {
    return this.collection.findOne({ name, stream }).then(toParsedRecord(schema));
  }

  /**
   * Removes a snapshot for the given reducer stream.
   *
   * @param name   - Name of the reducer the snapshot is attached to.
   * @param stream - Stream to remove from snapshots.
   */
  async remove(name: string, stream: string): Promise<void> {
    await this.collection.deleteOne({ name, stream });
  }
}
