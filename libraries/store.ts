import type { EventRecord } from "../types/event.ts";

class EventPushFailed {
  readonly result = "failure";

  constructor(readonly message: string) {}
}

export class EventDataValidationFailure extends EventPushFailed {
  readonly step = "validate";

  constructor(readonly data: unknown) {
    super("Invalid event 'data' provided.");
  }
}

export class EventValidationFailure extends EventPushFailed {
  readonly step = "validate";
}

export class EventInsertionFailure extends EventPushFailed {
  readonly step = "insert";
}

export class EventContextFailure extends EventPushFailed {
  readonly step = "context";
}

export class EventProjectionFailure extends EventPushFailed {
  readonly step = "project";
}

export class EventPushSuccess {
  readonly result = "success";

  constructor(readonly record: EventRecord) {}
}
