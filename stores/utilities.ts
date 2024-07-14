import {
  EventContextFailure,
  EventDataValidationFailure,
  EventInsertionFailure,
  EventProjectionFailure,
  EventValidationFailure,
} from "~libraries/errors.ts";

import type { PGEventStore } from "./pg/event-store.ts";
import type { SQLiteEventStore } from "./sqlite/event-store.ts";

/**
 * Push a new event using the provided event store instance.
 *
 * @param store    - Store used to insert the event record.
 * @param record   - Event record to push to the event store.
 * @param hydrated - Whether the record is hydrated or not.
 */
export async function pushEventRecord(
  store: PGEventStore<any> | SQLiteEventStore<any>,
  record: any,
  hydrated: boolean,
): Promise<string> {
  const status = await store.getEventStatus(record);
  if (status.exists === true) {
    return record.stream;
  }

  if (hydrated === true) {
    record.recorded = Date.now();
  }

  const validator = store.getValidator(record.type);
  if (validator !== undefined) {
    const result = await validator.safeParseAsync(record.data);
    if (result.success === false) {
      const eventError = new EventDataValidationFailure(result.error.flatten().fieldErrors);
      if (store.hooks?.beforeEventError !== undefined) {
        throw await store.hooks?.beforeEventError(record, eventError);
      }
      throw eventError;
    }
  }

  try {
    await store.validator.validate(record);
  } catch (error) {
    const eventError = new EventValidationFailure(error.message);
    if (store.hooks?.beforeEventError !== undefined) {
      throw await store.hooks?.beforeEventError(record, eventError);
    }
    throw eventError;
  }

  try {
    await store.events.insert(record);
  } catch (error) {
    const eventError = new EventInsertionFailure(error.message);
    if (store.hooks?.beforeEventError !== undefined) {
      throw await store.hooks?.beforeEventError(record, eventError);
    }
    throw eventError;
  }

  try {
    await store.contextor.push(record);
  } catch (error) {
    store.hooks?.afterEventError?.(record, new EventContextFailure(error.message));
  }

  try {
    await store.projector.project(record, { hydrated, outdated: status.outdated });
  } catch (error) {
    store.hooks?.afterEventError?.(record, new EventProjectionFailure(error.message));
  }

  return record.stream;
}
