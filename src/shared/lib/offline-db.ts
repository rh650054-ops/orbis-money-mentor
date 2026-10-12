/**
 * IndexedDB wrapper for offline data persistence in Vant.
 * Stores sales, approaches, DEFCON data, checklist items, and user settings locally.
 * Data is synced to the cloud when connection is restored.
 */

const DB_NAME = 'orbis_offline';
const DB_VERSION = 2; // v2 (12/10/2026): pending_venda — cada venda com id próprio

export interface OfflineRecord {
  id: string;
  store: string;
  data: Record<string, unknown>;
  created_at: string;
  synced: boolean;
  /** Versão do registro: muda a cada gravação na mesma chave (ver markSynced). */
  rev?: string;
}

const novaRev = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export type StoreName = 'pending_sales' | 'pending_venda' | 'pending_approaches' | 'pending_checklist' | 'pending_defcon' | 'cached_data';

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

      // Vendas uma a uma (defcon_sales) + total da sessão — ver venda-offline.ts
      if (!db.objectStoreNames.contains('pending_venda')) {
        db.createObjectStore('pending_venda', { keyPath: 'id' });
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
    // Cada gravação ganha versão nova — inclusive quando substitui o mesmo id
    // (o bloco usa o id do bloco como chave e é regravado a cada venda).
    tx.objectStore(store).put({ ...record, rev: novaRev() });
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function removeOfflineRecord(store: StoreName, id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(id);
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

/**
 * Marca como enviado SÓ se o registro guardado ainda é a mesma versão que foi enviada.
 * Corrida (12/10/2026): a sync lia R$ 100, uma venda regravava a chave com R$ 120
 * durante o envio, e o fim do envio dos R$ 100 marcava os R$ 120 como enviados —
 * a limpeza apagava a venda mais nova sem ela ter subido. Agora a versão nova fica
 * pendente e sobe na próxima sync.
 */
export async function markSynced(store: StoreName, id: string, rev?: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const objectStore = tx.objectStore(store);
    const getReq = objectStore.get(id);
    getReq.onsuccess = () => {
      if (getReq.result && getReq.result.rev === rev) {
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
