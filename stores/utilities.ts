import {
  EventContextFailure,
  EventDataValidationFailure,
  EventInsertionFailure,
  EventProjectionFailure,
  EventValidationFailure,
} from "~libraries/errors.ts";
import { getLogicalTimestamp } from "~libraries/time.ts";
import { ValkyrEventStore } from "~stores/valkyr/event-store.ts";
import type { EventStatus } from "~types/event.ts";

import type { PGEventStore } from "./pg/event-store.ts";
import type { SQLiteEventStore } from "./sqlite/event-store.ts";

export async function pushEventRecordSequence(
  store: PGEventStore<any> | SQLiteEventStore<any>,
  records: {
    record: any;
    hydrated: boolean;
  }[],
): Promise<void> {
  const inserts: {
    record: any;
    hydrated: boolean;
    status: EventStatus;
  }[] = [];

  for (const { record, hydrated } of records) {
    if (store.hasEvent(record.type) === false) {
      throw new Error(`Event '${record.type}' is not registered with the event store!`);
    }
    const status = await store.getEventStatus(record);
    if (status.exists === true) {
      continue;
    }
    if (hydrated === true) {
      record.recorded = getLogicalTimestamp();
    }
    await validateEventRecord(store, record);
    inserts.push({ record, hydrated, status });
  }

  await store.db.transaction(
    (async (tx: any) => {
      for (const { record } of inserts) {
        await store.events.insert(record, tx as any);
      }
    }) as any,
  );

  for (const { record, hydrated, status } of inserts) {
    await pushEventRecordUpdates(store, record, hydrated, status);
  }
}

/**
 * Push a new event using the provided event store instance.
 *
 * @param store    - Store used to insert the event record.
 * @param record   - Event record to push to the event store.
 * @param hydrated - Whether the record is hydrated or not.
 */
export async function pushEventRecord(
  store: PGEventStore<any> | SQLiteEventStore<any> | ValkyrEventStore<any>,
  record: any,
  hydrated: boolean,
): Promise<string> {
  if (store.hasEvent(record.type) === false) {
    throw new Error(`Event '${record.type}' is not registered with the event store!`);
  }

  const status = await store.getEventStatus(record);
  if (status.exists === true) {
    return record.stream;
  }

  if (hydrated === true) {
    record.recorded = getLogicalTimestamp();
  }

  await validateEventRecord(store, record);
  await insertEventRecord(store, record);
  await pushEventRecordUpdates(store, record, hydrated, status);

  return record.stream;
}

async function validateEventRecord(
  store: PGEventStore<any> | SQLiteEventStore<any> | ValkyrEventStore<any>,
  record: any,
) {
  const { data, meta } = store.getValidator(record.type);
  if (data !== undefined || meta !== undefined) {
    const errors = [];

    if (data !== undefined) {
      const result = await data.safeParseAsync(record.data);
      if (result.success === false) {
        errors.push(result.error.flatten().fieldErrors);
      }
    }

    if (meta !== undefined) {
      const result = await meta.safeParseAsync(record.meta);
      if (result.success === false) {
        errors.push(result.error.flatten().fieldErrors);
      }
    }

    if (errors.length > 0) {
      const error = new EventDataValidationFailure(errors);
      if (store.hooks?.beforeEventError !== undefined) {
        throw await store.hooks?.beforeEventError(error, record);
      }
      throw error;
    }
  }

  try {
    await store.validator.validate(record);
  } catch (error) {
    const eventError = new EventValidationFailure(error.message);
    if (store.hooks?.beforeEventError !== undefined) {
      throw await store.hooks?.beforeEventError(eventError, record);
    }
    throw eventError;
  }
}

async function insertEventRecord(
  store: PGEventStore<any> | SQLiteEventStore<any> | ValkyrEventStore<any>,
  record: any,
  tx?: any,
): Promise<void> {
  try {
    if (store instanceof ValkyrEventStore) {
      await store.events.insert(record);
    } else {
      await store.events.insert(record, tx);
    }
  } catch (error) {
    const eventError = new EventInsertionFailure(error.message);
    if (store.hooks?.beforeEventError !== undefined) {
      throw await store.hooks?.beforeEventError(eventError, record);
    }
    throw eventError;
  }
}

async function pushEventRecordUpdates(
  store: PGEventStore<any> | SQLiteEventStore<any> | ValkyrEventStore<any>,
  record: any,
  hydrated: boolean,
  status: EventStatus,
) {
  try {
    if ("contextor" in store) {
      await store.contextor.push(record);
    }
  } catch (error) {
    store.hooks?.afterEventError?.(new EventContextFailure(error.message), record);
  }

  try {
    await store.projector.project(record, { hydrated, outdated: status.outdated });
  } catch (error) {
    store.hooks?.afterEventError?.(new EventProjectionFailure(error.message), record);
  }

  store.hooks?.afterEventInsert?.(record, hydrated);
}
