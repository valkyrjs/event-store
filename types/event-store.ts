import type {
  EventContextFailure,
  EventInsertionFailure,
  EventProjectionFailure,
  EventPushSuccess,
  EventValidationFailure,
} from "~libraries/store.ts";

export type PushResult =
  | EventPushSuccess
  | EventValidationFailure
  | EventInsertionFailure
  | EventContextFailure
  | EventProjectionFailure;
