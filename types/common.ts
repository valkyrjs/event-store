export type Empty = Record<string, never>;

export type Unknown = Record<string, unknown>;

export type Subscription = {
  unsubscribe: () => void;
};
