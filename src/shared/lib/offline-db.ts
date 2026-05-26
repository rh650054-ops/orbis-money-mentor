/**
 * IndexedDB wrapper for offline data persistence in Orbis.
 * Stores sales, approaches, DEFCON data, checklist items, and user settings locally.
 * Data is synced to the cloud when connection is restored.
 */

const DB_NAME = 'orbis_offline';
const DB_VERSION = 1;

export interface OfflineRecord {
  id: string;
  store: string;
  data: Record<string, unknown>;
  created_at: string;
  synced: boolean;
}

type StoreName = 'pending_sales' | 'pending_approaches' | 'pending_checklist' | 'pending_defcon' | 'cached_data';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Pending sales to sync
      if (!db.objectStoreNames.contains('pending_sales')) {
        const store = db.createObjectStore('pending_sales', { keyPath: 'id' });
        store.createIndex('synced', 'synced', { unique: false });
      }

      // Pending approach counts
      if (!db.objectStoreNames.contains('pending_approaches')) {
        db.createObjectStore('pending_approaches', { keyPath: 'id' });
      }

      // Pending checklist updates
      if (!db.objectStoreNames.contains('pending_checklist')) {
        db.createObjectStore('pending_checklist', { keyPath: 'id' });
      }

      // Pending DEFCON data
      if (!db.objectStoreNames.contains('pending_defcon')) {
        db.createObjectStore('pending_defcon', { keyPath: 'id' });
      }

      // Cached data for offline display (dashboard, ranking, etc.)
      if (!db.objectStoreNames.contains('cached_data')) {
        db.createObjectStore('cached_data', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function addOfflineRecord(store: StoreName, record: OfflineRecord): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(record);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getUnsynced(store: StoreName): Promise<OfflineRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const all = tx.objectStore(store).getAll();
    all.onsuccess = () => {
      db.close();
      const records = (all.result as OfflineRecord[]).filter(r => !r.synced);
      resolve(records);
    };
    all.onerror = () => { db.close(); reject(all.error); };
  });
}

export async function markSynced(store: StoreName, id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const objectStore = tx.objectStore(store);
    const getReq = objectStore.get(id);
    getReq.onsuccess = () => {
      if (getReq.result) {
        getReq.result.synced = true;
        objectStore.put(getReq.result);
      }
    };
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function clearSynced(store: StoreName): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const objectStore = tx.objectStore(store);
    const all = objectStore.getAll();
    all.onsuccess = () => {
      (all.result as OfflineRecord[]).forEach(r => {
        if (r.synced) objectStore.delete(r.id);
      });
    };
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

// Cache arbitrary data for offline display
export async function setCachedData(key: string, data: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('cached_data', 'readwrite');
    tx.objectStore('cached_data').put({ key, data, updated_at: new Date().toISOString() });
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getCachedData<T = unknown>(key: string): Promise<{ data: T; updated_at: string } | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('cached_data', 'readonly');
    const req = tx.objectStore('cached_data').get(key);
    req.onsuccess = () => {
      db.close();
      resolve(req.result ? { data: req.result.data as T, updated_at: req.result.updated_at } : null);
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}
