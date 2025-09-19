import type { Empty } from "./common.ts";

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type ExcludeEmptyFields<T> = {
  [K in keyof T as T[K] extends Empty ? never : K]: T[K];
};
