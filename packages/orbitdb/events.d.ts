import type { EventEmitter } from "events";

import type { LogEntry } from "./log";

interface SyncEvents<T> extends EventEmitter {
  on(
    event: "join",
    listener: (peerId: string, heads: LogEntry<T>[]) => void,
  ): this;
  on(event: "leave", listener: (peerId: string) => void): this;
  on(event: "error", listener: (error: Error) => void): this;
}

interface DatabaseEvents<T = unknown> extends EventEmitter {
  on(
    event: "join",
    listener: (peerId: string, heads: LogEntry<T>[]) => void,
  ): this;
  on(event: "leave", listener: (peerId: string) => void): this;
  on(event: "close", listener: () => void): this;
  on(event: "drop", listener: () => void): this;
  on(event: "error", listener: (error: Error) => void): this;
  on(event: "update", listener: (entry: LogEntry<T>) => void): this;
}

export { DatabaseEvents, SyncEvents };