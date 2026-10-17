import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { openDb, type RhDb } from '../../src/lib/data/db';

let n = 0;
/** A fresh, empty in-memory database per call (fake-indexeddb implements IndexedDB in Node). */
export function freshDb(): RhDb {
  return openDb(`test-${++n}`, { indexedDB: new IDBFactory(), IDBKeyRange });
}
