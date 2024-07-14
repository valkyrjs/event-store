export class EventDataValidationFailure extends Error {
  readonly step = "validate";

  constructor(readonly data: unknown) {
    super("Invalid event 'data' provided.");
  }
}

export class EventValidationFailure extends Error {
  readonly step = "validate";
}

export class EventInsertionFailure extends Error {
  readonly step = "insert";
}

export class EventContextFailure extends Error {
  readonly step = "context";
}

export class EventProjectionFailure extends Error {
  readonly step = "project";
}

export type PreEventInsertError =
  | EventDataValidationFailure
  | EventValidationFailure
  | EventInsertionFailure;

export type PostEventInsertError =
  | EventContextFailure
  | EventProjectionFailure;
