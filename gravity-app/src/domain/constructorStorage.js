const DATABASE_NAME = 'data-driven-constructor';
const STORE_NAME = 'drafts';
const DATABASE_VERSION = 1;
const POINTER_PREFIX = '__data_driven_constructor_pointer__:';
const DRAFT_PREFIX = '__data_driven_constructor_draft__:';

function openDatabase() {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB недоступен'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error || new Error('Не удалось открыть IndexedDB'));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function transaction(mode, operation) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = database.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      let request;
      try {
        request = operation(store);
      } catch (error) {
        reject(error);
        return;
      }
      request.onerror = () => reject(request.error || new Error('Ошибка IndexedDB'));
      request.onsuccess = () => resolve(request.result);
      tx.onabort = () => reject(tx.error || new Error('Операция IndexedDB отменена'));
    });
  } finally {
    database.close();
  }
}

async function batchTransaction(operation) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = database.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      let result;
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error || new Error('Ошибка IndexedDB'));
      tx.onabort = () => reject(tx.error || new Error('Операция IndexedDB отменена'));
      try {
        result = operation(store);
      } catch (error) {
        try {
          tx.abort();
        } catch {
          // The original operation error is more useful than a second abort error.
        }
        reject(error);
      }
    });
  } finally {
    database.close();
  }
}

function pointerStorageKey(sourceKey) {
  return `${POINTER_PREFIX}${encodeURIComponent(sourceKey)}`;
}

function draftRecordKey(sourceKey, documentKey) {
  return `${DRAFT_PREFIX}${encodeURIComponent(sourceKey)}:${encodeURIComponent(documentKey)}`;
}

export function draftStorageKey(report) {
  const constructor = report?.constructor || {};
  return constructor.documentId || constructor.sourceFingerprint || 'default';
}

export async function loadConstructorDraft(key) {
  if (!key) return null;
  const recordKey = await transaction('readonly', (store) => store.get(pointerStorageKey(key)));
  if (recordKey) {
    const pointed = await transaction('readonly', (store) => store.get(recordKey));
    if (pointed) return pointed;
  }
  // Legacy drafts were stored directly under the source document key.
  return (await transaction('readonly', (store) => store.get(key))) ?? null;
}

export async function saveConstructorDraft(sourceKey, report) {
  if (!sourceKey) throw new Error('Не задан ключ исходного документа');
  const documentKey = draftStorageKey(report);
  const recordKey = draftRecordKey(sourceKey, documentKey);
  return batchTransaction((store) => {
    store.put(report, recordKey);
    store.put(recordKey, pointerStorageKey(sourceKey));
    return recordKey;
  });
}

export async function clearConstructorDraft(sourceKey) {
  if (!sourceKey) return;
  const pointerKey = pointerStorageKey(sourceKey);
  const recordKey = await transaction('readonly', (store) => store.get(pointerKey));
  return batchTransaction((store) => {
    if (recordKey) store.delete(recordKey);
    store.delete(pointerKey);
    store.delete(sourceKey);
  });
}
