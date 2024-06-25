interface IPFSBlockStorageOptions {
  ipfs: any;
  pin?: boolean;
  timeout?: number;
}

interface LRUStorageOptions {
  size?: string;
}

interface LevelStorageOptions {
  path?: string;
  valueEncoding?: string;
}

interface ComposedStorageInstance {
  put(hash: string, data: any): Promise<void>;
  get(hash: string): Promise<any>;
  del(hash: string): Promise<void>;
  close(): Promise<void>;
  clear(): Promise<void>;
  merge(other: StorageInstance): Promise<void>;
}
declare function ComposedStorage(storage1: StorageInstance, storage2: StorageInstance): Promise<ComposedStorageInstance>

interface IPFSBlockStorageInstance {
  get(hash: string): Promise<Uint8Array>;
  put(hash: string, value: any): Promise<void>;
}
declare function IPFSBlockStorage(options: IPFSBlockStorageOptions): Promise<IPFSBlockStorageInstance>

interface LRUStorageInstance {
  put(hash: string, data: any): Promise<void>;
  get(hash: string): Promise<any>;
  del(hash: string): Promise<void>;
  iterator(): AsyncGenerator<[string, any]>;
  merge(other: StorageInstance): Promise<void>;
  clear(): Promise<void>;
}
declare function LRUStorage(options?: LRUStorageOptions): Promise<LRUStorageInstance>

interface LevelStorageInstance {
  put(hash: string, data: any): Promise<void>;
  get(hash: string): Promise<any>;
  del(hash: string, data: any): Promise<void>;
  close(): Promise<void>;
  clear(): Promise<void>;
  iterator(): AsyncGenerator<[string, any]>;
}
declare function LevelStorage(options?: LevelStorageOptions): Promise<LevelStorageInstance>

interface MemoryStorageInstance {
  put(hash: string, data: any): Promise<void>;
  get(hash: string): Promise<any>;
  del(hash: string): Promise<void>;
  merge(other: StorageInstance): Promise<void>;
  iterator(): AsyncGenerator<[string, any]>;
  clear(): Promise<void>;
}
declare function MemoryStorage(): Promise<MemoryStorageInstance>

type StorageInstance = ComposedStorageInstance | IPFSBlockStorageInstance | LRUStorageInstance | LevelStorageInstance | MemoryStorageInstance

interface StorageTypeMap {
  composed: ComposedStorageInstance;
  ipfs: IPFSBlockStorageInstance;
  lru: LRUStorageInstance;
  level: LevelStorageInstance;
  memory: MemoryStorageInstance;
}
type StorageType = keyof StorageTypeMap;

export {
  StorageInstance,
  StorageTypeMap,
  StorageType,

  MemoryStorageInstance,
  MemoryStorage,

  LevelStorage,
  LevelStorageInstance,

  LRUStorageInstance,
  LRUStorage,

  IPFSBlockStorageInstance,
  IPFSBlockStorage,

  ComposedStorageInstance,
  ComposedStorage,
}
